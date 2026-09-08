import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { keccak256, toHex, parseEther } from "viem";
import { researchProject, graphCovers } from "./research-catalog";
import { hunters, type Mission, type MissionReport } from "./hunters";
import { actionProposalFor } from "./action-proposal";
import { coverageDecisionReceipt } from "./evidence-coverage";
import { policyReviewFromInput } from "./policy-envelope";
import type { StoredOpportunityReceipt } from "./opportunity-action";
import type {
  MissionFundingReceipt,
  PreparedMissionTransaction,
} from "./funding-types";

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
      CREATE INDEX IF NOT EXISTS research_attempt_time ON research_attempts(started_at);
      CREATE INDEX IF NOT EXISTS missions_owner ON missions(owner, created_at DESC);`);
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
  get(owner: string, id: string): Mission | null {
    const row = this.db
      .prepare("SELECT data FROM missions WHERE id=? AND owner=?")
      .get(id, owner);
    return row ? JSON.parse(String(row.data)) : null;
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
    const createdAt = new Date().toISOString();
    const id = `0x${randomBytes(32).toString("hex")}`;
    const thesis = hunter.question;
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    const mission: Mission = {
      id,
      ...(previous?{previousMissionId:previous.id}:{}),
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
