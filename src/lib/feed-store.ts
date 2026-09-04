import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import type { FeedEvent, Observation, SourceHealth } from "./feed-types";

const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export class FeedStore {
  private db: DatabaseSync;
  constructor(
    path = process.env.ARCMAP_DB_PATH ||
      resolve(process.cwd(), ".data/arcmap.sqlite"),
  ) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY, source_id TEXT NOT NULL, observed_at TEXT NOT NULL, payload TEXT NOT NULL,
        UNIQUE(source_id, observed_at));
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, observed_at TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS health (source_id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS leases (name TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS observation_source ON observations(source_id, observed_at DESC);`);
  }
  close() {
    this.db.close();
  }
  eventHead(): number {
    return Number(this.db.prepare("SELECT COALESCE(MAX(rowid),0) AS n FROM events").get()!.n);
  }
  eventsAfter(after: number, through: number) {
    return this.db.prepare("SELECT rowid AS sequence,data FROM events WHERE rowid>? AND rowid<=? ORDER BY rowid LIMIT 201").all(after, through)
      .map(r => ({ sequence: Number(r.sequence), event: JSON.parse(String(r.data)) as FeedEvent }));
  }
  acquireLease(now = Date.now(), duration = 60_000) {
    return (
      this.db
        .prepare(
          `INSERT INTO leases VALUES ('ingest', ?) ON CONFLICT(name)
      DO UPDATE SET expires_at=excluded.expires_at WHERE leases.expires_at <= ?`,
        )
        .run(now + duration, now).changes > 0
    );
  }
  record(observation: Observation): boolean {
    if (!Number.isFinite(Date.parse(observation.observedAt)))
      throw new Error("Invalid observation timestamp");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db
        .prepare(
          "SELECT payload, observed_at FROM observations WHERE source_id=? ORDER BY observed_at DESC LIMIT 1",
        )
        .get(observation.sourceId);
      if (row && String(row.observed_at) >= observation.observedAt) {
        this.db.exec("COMMIT");
        return false;
      }
      const previous = row
        ? (JSON.parse(String(row.payload)) as Observation)
        : null;
      this.db
        .prepare(
          "INSERT INTO observations(source_id,observed_at,payload) VALUES(?,?,?)",
        )
        .run(
          observation.sourceId,
          observation.observedAt,
          JSON.stringify(observation),
        );
      let event: FeedEvent | null = null;
      const base = {
        projectId: observation.projectId,
        sourceUrl: observation.sourceUrl,
        observedAt: observation.observedAt,
        eventAt: observation.eventAt,
        baselineAt: previous?.observedAt ?? null,
      };
      if (observation.kind === "code" && observation.payload.commit) {
        event = {
          ...base,
          id: hash([observation.sourceId, observation.payload.commit]),
          kind: "code",
          title: observation.payload.message || "Source commit observed",
          detail:
            "A commit on the tracked repository's default branch. Code activity is not proof of deployment or adoption.",
        };
      } else if (!previous) {
        event = {
          ...base,
          id: hash([observation.sourceId, "baseline"]),
          kind: "baseline",
          title: "The first snapshot. Not a launch announcement.",
          detail: `Explorer reports ${observation.payload.holders?.toLocaleString("en-US") ?? "unknown"} holder addresses and ${observation.payload.transfers?.toLocaleString("en-US") ?? "unknown"} transfers. Changes will be measured against later observations.`,
        };
      } else {
        const changes: string[] = [];
        for (const key of ["holders", "transfers"] as const) {
          const before = previous.payload[key],
            after = observation.payload[key];
          if (
            typeof before === "number" &&
            typeof after === "number" &&
            before !== after
          )
            changes.push(
              `${key === "holders" ? "Holder addresses" : "Transfer counter"}: ${before.toLocaleString("en-US")} → ${after.toLocaleString("en-US")}`,
            );
        }
        if (changes.length)
          event = {
            ...base,
            id: hash([observation.sourceId, observation.observedAt]),
            kind: "onchain",
            title: "The counters moved. Follow the trail.",
            detail:
              changes.join(". ") +
              ". Counter changes are not a count of active people.",
          };
      }
      const inserted = event
        ? this.db
            .prepare("INSERT OR IGNORE INTO events VALUES(?,?,?)")
            .run(event.id, event.observedAt, JSON.stringify(event)).changes > 0
        : false;
      const health: SourceHealth = {
        sourceId: observation.sourceId,
        lastAttempt: observation.observedAt,
        lastSuccess: observation.observedAt,
        error: null,
      };
      this.db
        .prepare("INSERT OR REPLACE INTO health VALUES(?,?)")
        .run(observation.sourceId, JSON.stringify(health));
      this.db.exec("COMMIT");
      return inserted;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  fail(sourceId: string, observedAt: string, error: string) {
    const old = this.health().find((source) => source.sourceId === sourceId);
    if (old && old.lastAttempt > observedAt) return;
    this.db
      .prepare("INSERT OR REPLACE INTO health VALUES(?,?)")
      .run(
        sourceId,
        JSON.stringify({
          sourceId,
          lastAttempt: observedAt,
          lastSuccess: old?.lastSuccess ?? null,
          error,
        } satisfies SourceHealth),
      );
  }
  health(): SourceHealth[] {
    return this.db
      .prepare("SELECT data FROM health")
      .all()
      .map((row) => JSON.parse(String(row.data)));
  }
  events(): FeedEvent[] {
    return this.db
      .prepare(
        "SELECT data FROM events ORDER BY observed_at DESC, id LIMIT 200",
      )
      .all()
      .map((row) => JSON.parse(String(row.data)));
  }
  latest(sourceId: string): Observation | null {
    const row = this.db
      .prepare(
        "SELECT payload FROM observations WHERE source_id=? ORDER BY observed_at DESC LIMIT 1",
      )
      .get(sourceId);
    return row ? JSON.parse(String(row.payload)) : null;
  }
}
