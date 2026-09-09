import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type WorkerName = "ingest" | "radar" | "theses";
export const EXPECTED_WORKERS: WorkerName[] = ["ingest", "radar", "theses"];

export type WorkerStatus = {
  name: WorkerName;
  pid: number | null;
  startedAt: string | null;
  lastAttempt: string | null;
  lastSuccess: string | null;
  lastError: string | null;
  cycles: number;
  state: "running" | "stopped" | "failed" | "missing";
};

function blank(name: WorkerName): WorkerStatus {
  return {
    name,
    pid: null,
    startedAt: null,
    lastAttempt: null,
    lastSuccess: null,
    lastError: null,
    cycles: 0,
    state: "missing",
  };
}

export class WorkerStatusStore {
  private db: DatabaseSync;

  constructor(
    path = process.env.ARCMAP_WORKER_STATUS_DB ||
      resolve(".data/worker-status.sqlite"),
  ) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: "0700" });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workers (name TEXT PRIMARY KEY, data TEXT NOT NULL);",
    );
  }

  close() {
    this.db.close();
  }

  private read(name: WorkerName): WorkerStatus | null {
    const row = this.db.prepare("SELECT data FROM workers WHERE name=?").get(name);
    return row ? (JSON.parse(String(row.data)) as WorkerStatus) : null;
  }

  private ensure(name: WorkerName): WorkerStatus {
    return this.read(name) ?? blank(name);
  }

  private write(status: WorkerStatus) {
    this.db
      .prepare("INSERT OR REPLACE INTO workers VALUES(?,?)")
      .run(status.name, JSON.stringify(status));
  }

  start(name: WorkerName, pid: number, at = new Date().toISOString()) {
    const old = this.ensure(name);
    this.write({
      name,
      pid,
      startedAt: at,
      lastAttempt: old.lastAttempt,
      lastSuccess: old.lastSuccess,
      // Process availability and source health are separate. A restart is only
      // an attempt to recover; retain the evidence error until success().
      lastError: old.lastError,
      cycles: old.cycles,
      state: old.state === "failed" ? "failed" : "running",
    });
  }

  attempt(name: WorkerName, at = new Date().toISOString()) {
    const old = this.ensure(name);
    this.write({
      ...old,
      name,
      lastAttempt: at,
      // Starting a request must not make the previous failure look recovered.
      state: old.state === "failed" ? "failed" : "running",
      lastError: old.lastError,
    });
  }

  success(name: WorkerName, at = new Date().toISOString()) {
    const old = this.ensure(name);
    this.write({
      ...old,
      name,
      lastAttempt: at,
      lastSuccess: at,
      lastError: null,
      cycles: old.cycles + 1,
      state: "running",
    });
  }

  fail(name: WorkerName, error: string, at = new Date().toISOString()) {
    const old = this.ensure(name);
    this.write({
      ...old,
      name,
      lastAttempt: at,
      lastError: error,
      state: "failed",
    });
  }

  stop(name: WorkerName, at = new Date().toISOString()) {
    const old = this.ensure(name);
    this.write({
      ...old,
      name,
      pid: null,
      state: "stopped",
      lastAttempt: old.lastAttempt ?? at,
    });
  }

  list(): WorkerStatus[] {
    return this.db
      .prepare("SELECT data FROM workers ORDER BY name")
      .all()
      .map((row) => JSON.parse(String(row.data)) as WorkerStatus);
  }

  /** Always returns the three expected workers; missing rows stay explicit. */
  listExpected(): WorkerStatus[] {
    return EXPECTED_WORKERS.map((name) => this.read(name) ?? blank(name));
  }
}

export function workerFreshness(
  status: WorkerStatus,
  now = Date.now(),
): "running" | "stale" | "failed" | "stopped" | "missing" {
  if (status.state === "missing") return "missing";
  if (status.state === "failed") return "failed";
  if (status.state === "stopped") return "stopped";
  const at = status.lastSuccess ? Date.parse(status.lastSuccess) : NaN;
  if (!Number.isFinite(at)) return "stale";
  // Reject clock skew / future timestamps — never treat them as live.
  if (at > now + 60_000) return "failed";
  return now - at <= 10 * 60_000 ? "running" : "stale";
}

export function summarizeWorkers(
  workers: Array<WorkerStatus & { freshness: ReturnType<typeof workerFreshness> }>,
): string {
  if (!workers.length) return "No worker identities registered";
  if (workers.every((w) => w.freshness === "running"))
    return "All source cycles live";
  const counts = workers.reduce(
    (result, worker) => {
      if (worker.freshness !== "running") result[worker.freshness] += 1;
      return result;
    },
    { stale: 0, failed: 0, stopped: 0, missing: 0 },
  );
  return [
    counts.failed && `${counts.failed} failed`,
    counts.stale && `${counts.stale} stale`,
    counts.stopped && `${counts.stopped} stopped`,
    counts.missing && `${counts.missing} missing`,
  ]
    .filter(Boolean)
    .join(" · ");
}
