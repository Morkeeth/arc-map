import { dailyBrief } from "./daily-brief";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { keccak256, toHex, parseEther } from "viem";
import { researchProject, graphCovers } from "./research-catalog";
import { actionProposalFor } from "./action-proposal";
import { coverageDecisionReceipt } from "./evidence-coverage";
import { policyReviewFromInput } from "./policy-envelope";
import type { StoredOpportunityReceipt } from "./opportunity-action";
import type {
  MissionFundingReceipt,
  PreparedMissionTransaction,
} from "./funding-types";
import {
  hunters,
  type Mission,
  type MissionCollaboration,
  type MissionCounterevidence,
  type MissionReport,
} from "./hunters";

function isPrivateSourceHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    /^(fc|fd|fe8|fe9|fea|feb)[0-9a-f:]*$/.test(host)
  )
    return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part)))
    return false;
  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

export class MissionStore {
  private db: DatabaseSync;
  constructor(
    path = process.env.ARCMAP_MISSIONS_DB ||
      resolve(process.cwd(), ".data/missions.sqlite"),
  ) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS missions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS research_attempts (owner TEXT NOT NULL, started_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS mission_invites (mission_id TEXT PRIMARY KEY, owner TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, accepted_by TEXT, accepted_at TEXT, revoked_at TEXT);
      CREATE TABLE IF NOT EXISTS mission_counterevidence (id TEXT PRIMARY KEY, mission_id TEXT NOT NULL, contributor TEXT NOT NULL, source_url TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS research_attempt_time ON research_attempts(started_at);
      CREATE INDEX IF NOT EXISTS missions_owner ON missions(owner, created_at DESC);
      CREATE INDEX IF NOT EXISTS counterevidence_mission ON mission_counterevidence(mission_id, created_at);`);
  }
  close() {
    this.db.close();
  }
  list(owner: string): Mission[] {
    return this.db
      .prepare(
        "SELECT data FROM missions WHERE owner=? ORDER BY created_at DESC LIMIT 100",
      )
      .all(owner)
      .map((r) => JSON.parse(String(r.data)));
  }
  listVisible(owner: string): Mission[] {
    return this.db
      .prepare(
        `SELECT m.owner AS mission_owner,m.data
         FROM missions m
         LEFT JOIN mission_invites i ON i.mission_id=m.id
         WHERE m.owner=? OR (i.accepted_by=? AND i.revoked_at IS NULL)
         ORDER BY m.created_at DESC LIMIT 100`,
      )
      .all(owner, owner)
      .map((row) =>
        this.withCollaboration(
          JSON.parse(String(row.data)),
          owner,
          String(row.mission_owner),
        ),
      );
  }
  get(owner: string, id: string): Mission | null {
    const row = this.db
      .prepare("SELECT data FROM missions WHERE id=? AND owner=?")
      .get(id, owner);
    return row ? JSON.parse(String(row.data)) : null;
  }
  getVisible(owner: string, id: string): Mission | null {
    const row = this.db
      .prepare(
        `SELECT m.owner AS mission_owner,m.data
         FROM missions m
         LEFT JOIN mission_invites i ON i.mission_id=m.id
         WHERE m.id=? AND (m.owner=? OR (i.accepted_by=? AND i.revoked_at IS NULL))`,
      )
      .get(id, owner, owner);
    return row
      ? this.withCollaboration(
          JSON.parse(String(row.data)),
          owner,
          String(row.mission_owner),
        )
      : null;
  }
  private withCollaboration(
    mission: Mission,
    viewer: string,
    missionOwner: string,
  ): Mission {
    const invite = this.db
      .prepare(
        "SELECT accepted_by,revoked_at FROM mission_invites WHERE mission_id=? AND owner=?",
      )
      .get(mission.id, missionOwner);
    const counterevidence = this.db
      .prepare(
        "SELECT id,source_url,note,created_at FROM mission_counterevidence WHERE mission_id=? ORDER BY created_at,rowid",
      )
      .all(mission.id)
      .map(
        (row): MissionCounterevidence => ({
          id: String(row.id),
          sourceUrl: String(row.source_url),
          note: String(row.note),
          createdAt: String(row.created_at),
        }),
      );
    const collaboration: MissionCollaboration = {
      role: viewer === missionOwner ? "owner" : "contributor",
      inviteActive: Boolean(invite && !invite.revoked_at),
      inviteAccepted: Boolean(invite?.accepted_by),
      counterevidence,
    };
    return { ...mission, collaboration };
  }
  createInvite(owner: string, missionId: string) {
    const mission = this.get(owner, missionId);
    if (!mission?.report || mission.status !== "reported")
      throw new Error("Only a completed investigation can be shared.");
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const createdAt = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("DELETE FROM mission_invites WHERE mission_id=? AND owner=?")
        .run(missionId, owner);
      this.db
        .prepare(
          "INSERT INTO mission_invites(mission_id,owner,token_hash,created_at) VALUES(?,?,?,?)",
        )
        .run(missionId, owner, tokenHash, createdAt);
      this.db.exec("COMMIT");
      return { token, createdAt };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  acceptInvite(recipient: string, token: unknown): Mission {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      throw new Error("This investigation invite is invalid.");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const invite = this.db
        .prepare(
          "SELECT mission_id,owner,accepted_by,revoked_at FROM mission_invites WHERE token_hash=?",
        )
        .get(tokenHash);
      if (!invite || invite.revoked_at)
        throw new Error("This investigation invite is unavailable or revoked.");
      if (String(invite.owner) === recipient)
        throw new Error("Open this invite in the contributor's separate session.");
      if (invite.accepted_by && String(invite.accepted_by) !== recipient)
        throw new Error("This investigation invite has already been accepted.");
      if (!invite.accepted_by) {
        const now = new Date().toISOString();
        this.db
          .prepare(
            "UPDATE mission_invites SET accepted_by=?,accepted_at=? WHERE token_hash=? AND accepted_by IS NULL AND revoked_at IS NULL",
          )
          .run(recipient, now, tokenHash);
      }
      this.db.exec("COMMIT");
      const mission = this.getVisible(recipient, String(invite.mission_id));
      if (!mission) throw new Error("Shared investigation is unavailable.");
      return mission;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  revokeInvite(owner: string, missionId: string): Mission {
    if (!this.get(owner, missionId)) throw new Error("Mission not found.");
    const result = this.db
      .prepare(
        "UPDATE mission_invites SET revoked_at=? WHERE mission_id=? AND owner=? AND revoked_at IS NULL",
      )
      .run(new Date().toISOString(), missionId, owner);
    if (!result.changes) throw new Error("No active invite to revoke.");
    return this.getVisible(owner, missionId)!;
  }
  addCounterevidence(
    contributor: string,
    missionId: string,
    input: Record<string, unknown>,
  ): Mission {
    const access = this.db
      .prepare(
        `SELECT m.data
         FROM missions m JOIN mission_invites i ON i.mission_id=m.id
         WHERE m.id=? AND i.accepted_by=? AND i.revoked_at IS NULL`,
      )
      .get(missionId, contributor);
    if (!access)
      throw new Error("Active contributor access is required.");
    const mission = JSON.parse(String(access.data)) as Mission;
    if (!mission.report || mission.status !== "reported")
      throw new Error("Counterevidence requires a completed investigation.");
    const note = typeof input.note === "string" ? input.note.trim() : "";
    if (note.length < 10 || note.length > 500)
      throw new Error("Counterevidence must be 10–500 characters.");
    if (typeof input.sourceUrl !== "string" || input.sourceUrl.length > 1000)
      throw new Error("A public HTTP(S) source URL is required.");
    let source: URL;
    try {
      source = new URL(input.sourceUrl);
    } catch {
      throw new Error("A valid public HTTP(S) source URL is required.");
    }
    if (
      !["http:", "https:"].includes(source.protocol) ||
      source.username ||
      source.password ||
      isPrivateSourceHost(source.hostname)
    )
      throw new Error("A public HTTP(S) source URL without credentials is required.");
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO mission_counterevidence(id,mission_id,contributor,source_url,note,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        `counter-${randomBytes(16).toString("hex")}`,
        missionId,
        contributor,
        source.toString(),
        note,
        createdAt,
      );
    return this.getVisible(contributor, missionId)!;
  }
  create(owner: string, input: Record<string, unknown>): Mission {
    const project = researchProject(input.projectId);
    if (!project?.contract)
      throw new Error("Choose a project with a sourced contract address.");
    if (input.provider !== "graph" && input.provider !== "explorer")
      throw new Error("Choose Graph or explorer explicitly.");
    if (input.provider === "graph" && !graphCovers(project.contract))
      throw new Error("This contract is not covered by the deployed Graph transfer index. Choose the explorer explicitly for a free preview.");
    const budget = typeof input.budget === "string" ? input.budget : "";
    if (
      !/^\d{1,2}(\.\d{1,4})?$/.test(budget) ||
      parseEther(budget) < parseEther("0.01") ||
      parseEther(budget) > parseEther("10")
    )
      throw new Error(
        "Testnet budget must be 0.01–10 USDC, with up to four decimal places.",
      );
    if (this.list(owner).length >= 100)
      throw new Error("This workspace has reached its 100 mission limit.");
    const hunter = project.researchKind === "contract" ? hunters[1] : hunters[0];
    let previous: Mission | null = null;
    if(input.previousMissionId!==undefined) {
      if(typeof input.previousMissionId!=="string")throw new Error("Invalid previous mission.");
      previous=this.get(owner,input.previousMissionId);
      if(!previous?.report || !previous.reportHash || previous.status!=="reported")throw new Error("Choose a completed report in this workspace as the baseline.");
      if(previous.address.toLowerCase()!==project.contract.toLowerCase() || previous.provider!==input.provider || previous.hunterId!==hunter.id)throw new Error("Comparison must keep the same contract, provider and Hunter.");
    }
    let sourceLead = previous?.sourceLead;
    if(!previous && input.leadId !== undefined) {
      if(typeof input.leadId !== "string") throw new Error("Choose a retained source lead.");
      const lead = dailyBrief().cards.find(c=>c.id===input.leadId && c.project.id===project.id);
      if(!lead) throw new Error("This source lead changed or expired. Refresh Today and choose it again.");
      sourceLead = {id:lead.id,question:lead.question,finding:lead.finding,observedAt:lead.observedAt,evidence:lead.evidence};
    }
    const createdAt = new Date().toISOString();
    const id = `0x${randomBytes(32).toString("hex")}`;
    const thesis = hunter.question;
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    const mission: Mission = {
      id,
      ...(previous?{previousMissionId:previous.id}:{}),
      ...(sourceLead ? {sourceLead} : {}),
      hunterId: hunter.id,
      projectId: project.id,
      address: project.contract,
      thesis,
      thesisHash: keccak256(
        toHex(
          JSON.stringify({
            version: 1,
            hunter: hunter.id,
            project: project.id,
            address: project.contract,
            thesis,
            provider: input.provider,
            budget,
            fee: "0.01",
            deadline,
            ...(previous?{previousMissionId:previous.id,previousReportHash:previous.reportHash}:{}),
          }),
        ),
      ),
      provider: input.provider,
      createdAt,
      deadline,
      budget,
      fee: "0.01",
      status: "created",
      report: null,
      reportHash: null,
      error: null,
      coverageDecision: null,
      policyReview: null,
      opportunityReceipt: null,
      fundingIntent: null,
      fundingReceipt: null,
    };
    this.db
      .prepare("INSERT INTO missions(id,owner,created_at,data) VALUES(?,?,?,?)")
      .run(id, owner, createdAt, JSON.stringify(mission));
    return mission;
  }
  savePolicyReview(
    owner: string,
    id: string,
    input: Record<string, unknown>,
    now = new Date().toISOString(),
  ): Mission {
    const mission = this.get(owner, id);
    if (!mission?.report || mission.status !== "reported")
      throw new Error("A completed Hunter report is required.");
    mission.policyReview = policyReviewFromInput({
      proposal: actionProposalFor(mission.report, mission.address),
      input,
      now,
    });
    this.db
      .prepare("UPDATE missions SET data=? WHERE id=? AND owner=?")
      .run(JSON.stringify(mission), id, owner);
    return mission;
  }
  saveOpportunityReceipt(
    owner: string,
    id: string,
    receipt: StoredOpportunityReceipt,
  ): Mission {
    const mission = this.get(owner, id);
    if (!mission?.report || mission.status !== "reported")
      throw new Error("A completed Hunter report is required.");
    mission.opportunityReceipt = receipt;
    this.db
      .prepare("UPDATE missions SET data=? WHERE id=? AND owner=?")
      .run(JSON.stringify(mission), id, owner);
    return mission;
  }
  saveFundingIntent(
    owner: string,
    id: string,
    intent: PreparedMissionTransaction,
    now = Date.now(),
  ): Mission {
    if (intent.action !== "fund" || !intent.policy)
      throw new Error("Only a policy-bound funding request can be retained.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const mission = this.get(owner, id);
      if (!mission?.report || mission.status !== "reported")
        throw new Error("A completed Hunter report is required.");
      if (mission.fundingReceipt)
        throw new Error("This mission already has a verified funding receipt.");
      const current = mission.fundingIntent;
      if (current && Date.parse(current.expiresAt) >= now) {
        if (
          current.account.toLowerCase() !== intent.account.toLowerCase()
        )
          throw new Error(
            "A funding request is already prepared for another account. Wait for it to expire.",
          );
        this.db.exec("COMMIT");
        return mission;
      }
      mission.fundingIntent = intent;
      this.db
        .prepare("UPDATE missions SET data=? WHERE id=? AND owner=?")
        .run(JSON.stringify(mission), id, owner);
      this.db.exec("COMMIT");
      return mission;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  saveFundingReceipt(
    owner: string,
    id: string,
    receipt: MissionFundingReceipt,
  ): Mission {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const mission = this.get(owner, id);
      if (!mission?.fundingIntent?.policy)
        throw new Error("No prepared funding request exists for this mission.");
      if (
        mission.fundingIntent.policy.bindingHash !== receipt.bindingHash
      )
        throw new Error("Funding receipt does not match the prepared policy.");
      if (
        mission.fundingReceipt &&
        mission.fundingReceipt.transactionHash !== receipt.transactionHash
      )
        throw new Error("A different funding receipt is already retained.");
      mission.fundingReceipt = receipt;
      this.db
        .prepare("UPDATE missions SET data=? WHERE id=? AND owner=?")
        .run(JSON.stringify(mission), id, owner);
      this.db.exec("COMMIT");
      return mission;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  claim(owner: string, id: string, now = Date.now()): Mission {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const mission = this.get(owner, id);
      if (!mission) throw new Error("Mission not found.");
      if (mission.status === "reported")
        throw new Error(
          "A completed report is immutable. Create another mission for new evidence.",
        );
      this.db
        .prepare("DELETE FROM research_attempts WHERE started_at < ?")
        .run(now - 3600000);
      const globalAttempts = Number(
        this.db.prepare("SELECT COUNT(*) AS n FROM research_attempts").get()!.n,
      );
      const ownerAttempts = Number(
        this.db
          .prepare(
            "SELECT COUNT(*) AS n FROM research_attempts WHERE owner=? AND started_at>?",
          )
          .get(owner, now - 60000)!.n,
      );
      if (globalAttempts >= 120 || ownerAttempts >= 5)
        throw new Error("Research rate limit reached. Try again later.");
      const claimed = this.db
        .prepare(
          "UPDATE missions SET lease_until=? WHERE id=? AND owner=? AND lease_until<=?",
        )
        .run(now + 60000, id, owner, now);
      if (!claimed.changes) throw new Error("This mission is already running.");
      this.db
        .prepare("INSERT INTO research_attempts VALUES(?,?)")
        .run(owner, now);
      mission.status = "researching";
      mission.error = null;
      this.db
        .prepare("UPDATE missions SET data=? WHERE id=? AND owner=?")
        .run(JSON.stringify(mission), id, owner);
      this.db.exec("COMMIT");
      return mission;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  finish(
    owner: string,
    id: string,
    report: MissionReport | null,
    error: string | null,
  ): Mission {
    const mission = this.get(owner, id);
    if (!mission || mission.status !== "researching")
      throw new Error("Mission is not running.");
    mission.report = report;
    mission.reportHash = report
      ? keccak256(toHex(JSON.stringify(report)))
      : null;
    mission.coverageDecision =
      report && mission.reportHash
        ? coverageDecisionReceipt(mission, mission.reportHash)
        : null;
    mission.status = report ? "reported" : "blocked";
    mission.error = error;
    this.db
      .prepare(
        "UPDATE missions SET data=?, lease_until=0 WHERE id=? AND owner=?",
      )
      .run(JSON.stringify(mission), id, owner);
    return mission;
  }
}
