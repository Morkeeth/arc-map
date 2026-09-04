import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { ADDRESS } from "./analysis";
import type { RadarObservation, RadarRecord, RadarEvent } from "./radar-types";

export class RadarStore {
  private db: DatabaseSync;
  constructor(path = process.env.ARCMAP_RADAR_DB || resolve(".data/radar.sqlite")) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS radar (id TEXT PRIMARY KEY, last_seen TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS radar_events (id TEXT PRIMARY KEY, observed_at TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS radar_health (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS radar_source_state (id TEXT PRIMARY KEY, observed_at TEXT NOT NULL, fingerprint TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS radar_lease (id INTEGER PRIMARY KEY, until INTEGER NOT NULL);`);
  }
  close() { this.db.close(); }
  acquire(now = Date.now()) {
    return this.db.prepare("INSERT INTO radar_lease VALUES(1,?) ON CONFLICT(id) DO UPDATE SET until=excluded.until WHERE until<=?").run(now + 60000, now).changes > 0;
  }
  get(id: string): RadarRecord | null {
    const row = this.db.prepare("SELECT data FROM radar WHERE id=?").get(id);
    return row ? JSON.parse(String(row.data)) : null;
  }
  list(): RadarRecord[] {
    return this.db.prepare("SELECT data FROM radar ORDER BY last_seen DESC,id LIMIT 1000").all().map(r => JSON.parse(String(r.data)));
  }
  events(): RadarEvent[] {
    return this.db.prepare("SELECT data FROM radar_events ORDER BY observed_at DESC,id LIMIT 200").all().map(r => JSON.parse(String(r.data)));
  }
  health(): { id: string; lastAttempt: string; lastSuccess: string | null; error: string | null }[] {
    return this.db.prepare("SELECT data FROM radar_health").all().map(r => JSON.parse(String(r.data)));
  }
  markSource(id: string, at: string, error: string | null) {
    const old = this.health().find(h => h.id === id);
    if (old && old.lastAttempt > at) return;
    this.db.prepare("INSERT OR REPLACE INTO radar_health VALUES(?,?)").run(id, JSON.stringify({ id, lastAttempt: at, lastSuccess: error ? old?.lastSuccess ?? null : at, error }));
  }
  record(observation: RadarObservation) {
    if (!ADDRESS.test(observation.address) || !Number.isFinite(Date.parse(observation.observedAt))) throw new Error("Invalid radar observation");
    const id = `arc:${observation.address.toLowerCase()}`;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const old = this.get(id);
      const sourceKey = `${id}:${observation.source}`;
      const priorSource = this.db.prepare("SELECT observed_at,fingerprint FROM radar_source_state WHERE id=?").get(sourceKey);
      if (priorSource && Date.parse(String(priorSource.observed_at)) >= Date.parse(observation.observedAt)) { this.db.exec("COMMIT"); return false; }
      if (!old && Number(this.db.prepare("SELECT COUNT(*) AS n FROM radar").get()!.n) >= 1000) { this.db.exec("COMMIT"); return false; }
      const next: RadarRecord = {
        id, address: observation.address.toLowerCase(),
        name: observation.kind === "token" || !old || old.kind !== "token" ? observation.name : old.name,
        symbol: observation.symbol ?? old?.symbol ?? null,
        kind: observation.kind === "token" || old?.kind === "token" ? "token" : "contract",
        firstObservedAt: old && Date.parse(old.firstObservedAt) < Date.parse(observation.observedAt) ? old.firstObservedAt : observation.observedAt,
        lastObservedAt: old && Date.parse(old.lastObservedAt) > Date.parse(observation.observedAt) ? old.lastObservedAt : observation.observedAt,
        verifiedAt: observation.source === "verification" ? observation.eventAt : old?.verifiedAt ?? null,
        lastActivityAt: observation.source === "transaction" && (!old?.lastActivityAt || (observation.eventAt && observation.eventAt > old.lastActivityAt)) ? observation.eventAt : old?.lastActivityAt ?? null,
        holders: observation.source === "token-list" ? observation.holders : old?.holders ?? null,
        sourceCodeVerified: observation.sourceCodeVerified ?? old?.sourceCodeVerified ?? null,
        sources: [...new Set([...(old?.sources ?? []), observation.source])],
      };
      this.db.prepare("INSERT OR REPLACE INTO radar VALUES(?,?,?)").run(id, next.lastObservedAt, JSON.stringify(next));
      const content = observation.source === "token-list"
        ? [id, observation.source, observation.name, observation.symbol, observation.holders]
        : [id, observation.source, observation.eventId || observation.eventAt];
      const fingerprint = createHash("sha256").update(JSON.stringify(content)).digest("hex");
      const changed = priorSource?.fingerprint !== fingerprint;
      this.db.prepare("INSERT OR REPLACE INTO radar_source_state VALUES(?,?,?)").run(sourceKey, observation.observedAt, fingerprint);
      if (observation.source === "token-list" && !changed) { this.db.exec("COMMIT"); return false; }
      const eventId = observation.source === "token-list"
        ? createHash("sha256").update(`${fingerprint}:${observation.observedAt}`).digest("hex") : fingerprint;
      const title = observation.source === "verification" ? "Source code verified on Arcscan"
        : observation.source === "transaction" ? "Contract activity observed"
        : old ? "Token listing observation changed" : "Token entered the observed catalog";
      const event: RadarEvent = { ...observation, id: eventId, title };
      const inserted = this.db.prepare("INSERT OR IGNORE INTO radar_events VALUES(?,?,?)").run(eventId, observation.observedAt, JSON.stringify(event)).changes > 0;
      this.db.exec("COMMIT");
      return inserted;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
}
