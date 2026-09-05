import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { projects } from "./projects";
import { claimTokens, evaluateShipClaim, type ShipClaimReport } from "./ship-claim";
import type { ReleaseObservation } from "./providers/releases";

export type ShipRerun = {
  observedAt: string;
  observationHash: string;
  report: ShipClaimReport;
  changedFromPinned: boolean;
};

export type ShipInvestigation = {
  id: string;
  projectId: string;
  repository: string;
  claim: string;
  claimTokens: string[];
  createdAt: string;
  status: "created" | "observed" | "blocked";
  observation: ReleaseObservation | null;
  report: ShipClaimReport | null;
  observationHash: string | null;
  reruns: ShipRerun[];
  error: string | null;
};

export function hashObservation(observation: ReleaseObservation) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        repository: observation.repository,
        releases: observation.releases.map((r) => ({
          id: r.id,
          tag: r.tag,
          draft: r.draft,
          prerelease: r.prerelease,
          publishedAt: r.publishedAt,
          binaryAssets: r.binaryAssets,
          assetNames: r.assets.map((a) => a.name),
        })),
      }),
    )
    .digest("hex");
}

export class ShipStore {
  private db: DatabaseSync;
  constructor(
    path = process.env.ARCMAP_SHIP_DB ||
      resolve(process.cwd(), ".data/ship-investigations.sqlite"),
  ) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS ship_investigations (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ship_owner ON ship_investigations(owner, created_at DESC);`);
  }
  close() {
    this.db.close();
  }
  list(owner: string): ShipInvestigation[] {
    return this.db
      .prepare(
        "SELECT data FROM ship_investigations WHERE owner=? ORDER BY created_at DESC LIMIT 50",
      )
      .all(owner)
      .map((row) => JSON.parse(String(row.data)) as ShipInvestigation)
      .map((row) => ({ ...row, reruns: row.reruns || [] }));
  }
  get(owner: string, id: string): ShipInvestigation | null {
    const row = this.db
      .prepare("SELECT data FROM ship_investigations WHERE id=? AND owner=?")
      .get(id, owner);
    if (!row) return null;
    const data = JSON.parse(String(row.data)) as ShipInvestigation;
    return { ...data, reruns: data.reruns || [] };
  }
  private write(owner: string, investigation: ShipInvestigation) {
    this.db
      .prepare("UPDATE ship_investigations SET data=? WHERE id=? AND owner=?")
      .run(JSON.stringify(investigation), investigation.id, owner);
  }
  create(owner: string, input: { projectId: unknown; claim: unknown }): ShipInvestigation {
    if (typeof input.projectId !== "string") throw new Error("Project ID required.");
    if (typeof input.claim !== "string") throw new Error("Claim required.");
    const project = projects.find((p) => p.id === input.projectId && p.repo);
    if (!project?.repo)
      throw new Error("Choose a curated project with a sourced repository association.");
    const tokens = claimTokens(input.claim);
    if (this.list(owner).length >= 50)
      throw new Error("This workspace has reached its 50 Ship Hunter investigation limit.");
    const createdAt = new Date().toISOString();
    const investigation: ShipInvestigation = {
      id: `ship_${randomBytes(16).toString("hex")}`,
      projectId: project.id,
      repository: project.repo,
      claim: input.claim.trim(),
      claimTokens: tokens,
      createdAt,
      status: "created",
      observation: null,
      report: null,
      observationHash: null,
      reruns: [],
      error: null,
    };
    this.db
      .prepare(
        "INSERT INTO ship_investigations(id,owner,created_at,data) VALUES(?,?,?,?)",
      )
      .run(investigation.id, owner, createdAt, JSON.stringify(investigation));
    return investigation;
  }
  /** Pin the first successful observation. Claim and pinned evidence stay immutable. */
  pinObservation(
    owner: string,
    id: string,
    observation: ReleaseObservation,
  ): ShipInvestigation {
    const current = this.get(owner, id);
    if (!current) throw new Error("Investigation not found.");
    if (current.status === "observed" && current.observation)
      throw new Error(
        "Pinned observation is immutable. Use re-observe to append a comparison rerun.",
      );
    if (observation.projectId !== current.projectId)
      throw new Error("Observation project does not match the saved investigation.");
    const report = evaluateShipClaim(observation, current.claim);
    const next: ShipInvestigation = {
      ...current,
      status: "observed",
      observation,
      report,
      observationHash: hashObservation(observation),
      error: null,
    };
    this.write(owner, next);
    return next;
  }
  /** Append a rerun comparison without rewriting the pinned observation or claim. */
  appendRerun(
    owner: string,
    id: string,
    observation: ReleaseObservation,
  ): { investigation: ShipInvestigation; rerun: ShipRerun } {
    const current = this.get(owner, id);
    if (!current) throw new Error("Investigation not found.");
    if (current.status !== "observed" || !current.observationHash || !current.observation)
      throw new Error("Pin an observation before requesting a rerun comparison.");
    if (observation.projectId !== current.projectId)
      throw new Error("Observation project does not match the saved investigation.");
    const observationHash = hashObservation(observation);
    const report = evaluateShipClaim(observation, current.claim);
    const rerun: ShipRerun = {
      observedAt: observation.observedAt,
      observationHash,
      report,
      changedFromPinned: observationHash !== current.observationHash,
    };
    const next: ShipInvestigation = {
      ...current,
      reruns: [...current.reruns, rerun].slice(-20),
    };
    this.write(owner, next);
    return { investigation: next, rerun };
  }
  block(owner: string, id: string, error: string): ShipInvestigation {
    const current = this.get(owner, id);
    if (!current) throw new Error("Investigation not found.");
    if (current.status === "observed" && current.report)
      throw new Error(
        "A completed Ship Hunter observation is immutable. Create another investigation for new evidence.",
      );
    const next: ShipInvestigation = { ...current, status: "blocked", error };
    this.write(owner, next);
    return next;
  }
}
