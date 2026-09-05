import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { researchProject } from "./research-catalog";
import { evaluateThesis, readThesisEvidence } from "./thesis-evidence";
import type { Thesis, ThesisSample, ThesisCheck, ThesisMetric, ThesisResearch } from "./thesis-types";
import { MissionStore } from "./mission-store";
import { keccak256, toHex } from "viem";

export function validateThesisInput(input: Record<string, unknown>) {
  const project = researchProject(input.projectId);
  if (!project) throw new Error("Choose a sourced project.");
  const metric = input.metric as ThesisMetric;
  if (!["transfer-counter", "holder-counter", "repository-head", "transaction-counter"].includes(metric)) throw new Error("Choose a supported observable criterion.");
  if (project.researchKind === "contract" && metric !== "transaction-counter") throw new Error("Generic contract theses use the address transaction counter, not token counters.");
  if (metric === "repository-head" ? !project.repo : !project.contract) throw new Error("This target does not have the required verified source association.");
  const claim = typeof input.claim === "string" ? input.claim.trim() : "";
  if (claim.length < 10 || claim.length > 400) throw new Error("Write a claim between 10 and 400 characters.");
  const threshold = metric === "repository-head" ? 1 : input.threshold;
  const hours = input.hours ?? 8, interval = input.intervalMinutes ?? 30, checks = input.checks ?? 16;
  if (!Number.isSafeInteger(threshold) || Number(threshold) < 1 || Number(threshold) > 1000000) throw new Error("Choose a whole-number threshold from 1 to 1,000,000.");
  if (!Number.isSafeInteger(hours) || Number(hours) < 1 || Number(hours) > 168) throw new Error("Horizon must be 1–168 hours.");
  if (!Number.isSafeInteger(interval) || Number(interval) < 15 || Number(interval) > 1440) throw new Error("Check interval must be 15–1,440 minutes.");
  if (!Number.isSafeInteger(checks) || Number(checks) < 1 || Number(checks) > 24) throw new Error("Choose 1–24 checks. This is a finite read-only schedule.");
  return { project, metric, claim, threshold: Number(threshold), hours: Number(hours), interval: Number(interval), checks: Number(checks) };
}

export class ThesisStore {
  private db: DatabaseSync;
  constructor(path = process.env.ARCMAP_THESES_DB || resolve(".data/theses.sqlite")) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS theses (id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL, next_at INTEGER, lease_until INTEGER NOT NULL DEFAULT 0, lease_token TEXT);
      CREATE TABLE IF NOT EXISTS thesis_checks (id INTEGER PRIMARY KEY, thesis_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS thesis_attempts (owner TEXT NOT NULL, at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS thesis_research(thesis_id TEXT NOT NULL,mission_id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(thesis_id,mission_id));
      CREATE INDEX IF NOT EXISTS theses_owner ON theses(owner);
      CREATE INDEX IF NOT EXISTS thesis_checks_target ON thesis_checks(thesis_id,id);`);
  }
  close() { this.db.close(); }
  get(owner: string, id: string): Thesis | null {
    const row = this.db.prepare("SELECT data FROM theses WHERE owner=? AND id=?").get(owner,id);
    return row ? JSON.parse(String(row.data)) : null;
  }
  list(owner: string): Thesis[] { return this.db.prepare("SELECT data FROM theses WHERE owner=? ORDER BY rowid DESC LIMIT 50").all(owner).map(r => JSON.parse(String(r.data))); }
  checks(owner: string, id: string): ThesisCheck[] {
    if (!this.get(owner,id)) throw new Error("Thesis not found.");
    return this.db.prepare("SELECT id,data FROM thesis_checks WHERE thesis_id=? ORDER BY id").all(id).map(r => ({ ...JSON.parse(String(r.data)), id: Number(r.id) }));
  }
  reserveRequest(owner: string, now = Date.now()) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM thesis_attempts WHERE at<?").run(now-3600000);
      const all = Number(this.db.prepare("SELECT COUNT(*) AS n FROM thesis_attempts").get()!.n);
      const recent = Number(this.db.prepare("SELECT COUNT(*) AS n FROM thesis_attempts WHERE owner=? AND at>?").get(owner, now-60000)!.n);
      if (all >= 20 || recent >= 3) throw new Error("Thesis source request limit reached. Retry later.");
      this.db.prepare("INSERT INTO thesis_attempts VALUES(?,?)").run(owner, now);
      this.db.exec("COMMIT");
    } catch(e) { this.db.exec("ROLLBACK"); throw e; }
  }
  research(owner:string,id:string):ThesisResearch[] {
    if(!this.get(owner,id))throw new Error("Thesis not found.");
    return this.db.prepare("SELECT data FROM thesis_research WHERE thesis_id=? ORDER BY rowid").all(id).map(r=>JSON.parse(String(r.data)));
  }
  attachResearch(owner:string,id:string,missionId:string,missionStore?:MissionStore) {
    const store=missionStore || new MissionStore();
    try {
      const thesis=this.get(owner,id), mission=store.get(owner,missionId);
      if(!thesis || !mission?.report || !mission.reportHash || mission.status!=="reported")throw new Error("Choose your completed research report and thesis.");
      const project=researchProject(thesis.projectId);
      if(!project?.contract || project.contract.toLowerCase()!==mission.address.toLowerCase())throw new Error("Research must concern the thesis's sourced contract.");
      if(keccak256(toHex(JSON.stringify(mission.report)))!==mission.reportHash)throw new Error("Report commitment does not match its content.");
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const links=this.research(owner,id);
        if(links.length>=20&&!links.some(r=>r.missionId===missionId))throw new Error("Attach up to 20 reports to a thesis.");
        const link:ThesisResearch={missionId,attachedAt:new Date().toISOString(),reportHash:mission.reportHash,report:mission.report};
        this.db.prepare("INSERT OR IGNORE INTO thesis_research VALUES(?,?,?)").run(id,missionId,JSON.stringify(link));
        this.db.exec("COMMIT");
      }catch(e){this.db.exec("ROLLBACK");throw e;}
      return this.research(owner,id);
    }finally{if(!missionStore)store.close();}
  }
  create(owner: string, input: Record<string, unknown>, baseline: ThesisSample, now = Date.now()): Thesis {
    const config = validateThesisInput(input);
    if (baseline.metric !== config.metric || !Number.isFinite(Date.parse(baseline.observedAt)) || Math.abs(now-Date.parse(baseline.observedAt)) > 120000) throw new Error("A fresh matching baseline is required.");
    if (config.metric === "repository-head" ? typeof baseline.value !== "string" || !/^[a-f0-9]{40}$/i.test(baseline.value) : typeof baseline.value !== "number" || !Number.isSafeInteger(baseline.value) || baseline.value < 0) throw new Error("Invalid baseline value.");
    if(typeof baseline.value==="number"&&!Number.isSafeInteger(baseline.value+config.threshold))throw new Error("The resulting counter target exceeds supported precision.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (this.list(owner).length >= 50) throw new Error("This workspace has reached its 50-thesis limit.");
      const id = randomUUID(), createdAt = new Date(now).toISOString(), deadline = new Date(now + config.hours*3600000).toISOString();
      const committed = { id, projectId: config.project.id, claim: config.claim, metric: config.metric, threshold: config.threshold, createdAt, deadline, baseline };
      const thesis: Thesis = { ...committed, projectName: config.project.name, commitment: createHash("sha256").update(JSON.stringify(committed)).digest("hex"), status: "tracking", intervalMinutes: config.interval, remainingChecks: config.checks, nextCheckAt: new Date(Math.min(now+config.interval*60000,Date.parse(deadline))).toISOString(), lastCheckAt: null };
      this.db.prepare("INSERT INTO theses(id,owner,data,next_at) VALUES(?,?,?,?)").run(id,owner,JSON.stringify(thesis),Date.parse(thesis.nextCheckAt!));
      this.db.exec("COMMIT"); return thesis;
    } catch(e) { this.db.exec("ROLLBACK"); throw e; }
  }
  claim(owner: string, id: string, now = Date.now(), scheduled = false) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const thesis = this.get(owner,id);
      if (!thesis || thesis.status !== "tracking" || thesis.remainingChecks < 1) throw new Error("No active checks remain for this thesis.");
      if (scheduled && thesis.nextCheckAt && Date.parse(thesis.nextCheckAt)>now) throw new Error("Thesis is not due.");
      if (thesis.lastCheckAt && now-Date.parse(thesis.lastCheckAt)<60000) throw new Error("Wait one minute between checks.");
      const token = randomUUID();
      const changed = this.db.prepare("UPDATE theses SET lease_until=?,lease_token=? WHERE id=? AND owner=? AND lease_until<=?").run(now+60000,token,id,owner,now).changes;
      if (!changed) throw new Error("This thesis is already being checked.");
      this.db.exec("COMMIT"); return { thesis, token };
    } catch(e) { this.db.exec("ROLLBACK"); throw e; }
  }
  finish(owner: string, id: string, token: string, sample: ThesisSample | null, error: string | null, now = Date.now()) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db.prepare("SELECT lease_token,lease_until FROM theses WHERE id=? AND owner=?").get(id,owner);
      const thesis = this.get(owner,id);
      if (!thesis || thesis.status !== "tracking" || row?.lease_token !== token || Number(row.lease_until)<now) throw new Error("Thesis check no longer owns its lease.");
      const checkedAt = new Date(now).toISOString();
      const evaluated = sample ? evaluateThesis(thesis,sample) : { met: false, observation: "Source unavailable. No outcome inferred." };
      if (sample && Math.abs(now-Date.parse(sample.observedAt))>120000) throw new Error("Check sample is stale.");
      const check = { thesisId:id,checkedAt,sample,error,...evaluated };
      this.db.prepare("INSERT INTO thesis_checks(thesis_id,data) VALUES(?,?)").run(id,JSON.stringify(check));
      thesis.remainingChecks--;
      thesis.lastCheckAt = checkedAt;
      if (evaluated.met) thesis.status="observed";
      else if (now>=Date.parse(thesis.deadline)) thesis.status=error ? "inconclusive" : "not-observed";
      else if (!thesis.remainingChecks) thesis.status="inconclusive";
      thesis.nextCheckAt = thesis.status === "tracking" ? new Date(Math.min(now+thesis.intervalMinutes*60000,Date.parse(thesis.deadline))).toISOString() : null;
      this.db.prepare("UPDATE theses SET data=?,next_at=?,lease_until=0,lease_token=NULL WHERE id=? AND owner=?").run(JSON.stringify(thesis),thesis.nextCheckAt ? Date.parse(thesis.nextCheckAt) : null,id,owner);
      this.db.exec("COMMIT"); return thesis;
    } catch(e) { this.db.exec("ROLLBACK"); throw e; }
  }
  cancel(owner: string, id: string) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const thesis=this.get(owner,id);
      if (!thesis) throw new Error("Thesis not found.");
      if (thesis.status === "tracking") {
        thesis.status="cancelled"; thesis.nextCheckAt=null;
        this.db.prepare("UPDATE theses SET data=?,next_at=NULL,lease_until=0,lease_token=NULL WHERE id=? AND owner=?").run(JSON.stringify(thesis),id,owner);
      }
      this.db.exec("COMMIT"); return thesis;
    } catch(e) { this.db.exec("ROLLBACK"); throw e; }
  }
  due(now=Date.now()): { id:string; owner:string }[] {
    return this.db.prepare("SELECT id,owner FROM theses WHERE next_at<=? AND lease_until<=? ORDER BY next_at LIMIT 10").all(now,now).map(r=>({id:String(r.id),owner:String(r.owner)}));
  }
}
export async function checkThesis(store:ThesisStore, owner:string, id:string, scheduled=false) {
  if (!store.get(owner,id)) throw new Error("Thesis not found.");
  store.reserveRequest(owner);
  const claimed=store.claim(owner,id,Date.now(),scheduled);
  let sample:ThesisSample|null=null,error:string|null=null;
  try { sample=await readThesisEvidence(claimed.thesis.projectId,claimed.thesis.metric); }
  catch { error="Selected source unavailable or invalid. No substitute source was used."; }
  return store.finish(owner,id,claimed.token,sample,error);
}
