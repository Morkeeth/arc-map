import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { FeedStore } from "../src/lib/feed-store";
import { ingest } from "../src/lib/ingest";
import { WorkerStatusStore } from "../src/lib/worker-status";
import { writeFileSync } from "node:fs";

test("network-denied ingest fails status and does not set lastSuccess", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arcmap-netdeny-"));
  process.env.ARCMAP_DB_PATH = join(dir, "arcmap.sqlite");
  process.env.ARCMAP_WORKER_STATUS_DB = join(dir, "worker-status.sqlite");
  const store = new FeedStore();
  const status = new WorkerStatusStore();
  status.start("ingest", 1);
  status.attempt("ingest");
  const result = await ingest(store, async () => {
    throw new Error("network denied");
  });
  const errored = store.health().filter((s) => s.error);
  assert.equal(result.skipped, false);
  assert.ok(errored.length > 0);
  status.fail("ingest", `${errored.length} failed`);
  const row = status.list()[0];
  assert.equal(row.state, "failed");
  assert.equal(row.lastSuccess, null);
  store.close();
  status.close();
  rmSync(dir, { recursive: true, force: true });
});

test("lease-skipped ingest does not advance lastSuccess", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arcmap-lease-"));
  process.env.ARCMAP_DB_PATH = join(dir, "arcmap.sqlite");
  process.env.ARCMAP_WORKER_STATUS_DB = join(dir, "worker-status.sqlite");
  const holder = new FeedStore();
  assert.equal(holder.acquireLease(), true);
  const contender = new FeedStore();
  const status = new WorkerStatusStore();
  status.start("ingest", 1);
  status.attempt("ingest");
  const result = await ingest(contender);
  assert.equal(result.skipped, true);
  status.fail("ingest", "lease skipped");
  assert.equal(status.list()[0].lastSuccess, null);
  holder.close();
  contender.close();
  status.close();
  rmSync(dir, { recursive: true, force: true });
});

test(
  "supervisor relaunches after simultaneous child SIGKILL",
  { timeout: 20_000 },
  async () => {
    const data = mkdtempSync(join(tmpdir(), "arcmap-sup-"));
    const env = {
      ...process.env,
      ARCMAP_WORKER_STATUS_DB: join(data, "worker-status.sqlite"),
      ARCMAP_DB_PATH: join(data, "arcmap.sqlite"),
      ARCMAP_RADAR_DB: join(data, "radar.sqlite"),
      ARCMAP_MISSIONS_DB: join(data, "missions.sqlite"),
      ARCMAP_THESES_DB: join(data, "theses.sqlite"),
    };
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/workers.ts"],
      { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] },
    );
    try {
      await sleep(2500);
      assert.equal(child.exitCode, null, "supervisor exited early");
      function workerPids() {
        const status = new WorkerStatusStore(env.ARCMAP_WORKER_STATUS_DB);
        try {
          // A live worker can truthfully be in failed source state. PID is the
          // supervisor-lifecycle signal; state is the evidence-health signal.
          return status.list().flatMap((worker) =>
            worker.pid ? [worker.pid] : [],
          );
        } finally {
          status.close();
        }
      }
      const kids = workerPids();
      assert.equal(kids.length, 3, "expected all supervised worker PIDs");
      for (const pid of kids) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
      }
      await sleep(4500);
      assert.equal(child.exitCode, null, "supervisor died after mass kill");
      const relaunched = workerPids();
      assert.equal(relaunched.length, 3, "all workers must relaunch");
      assert.ok(
        relaunched.every((pid) => !kids.includes(pid)),
        "relaunch must register replacement PIDs",
      );
    } finally {
      try {
        process.kill(child.pid!, "SIGTERM");
      } catch {}
      await sleep(1000);
      rmSync(data, { recursive: true, force: true });
    }
  },
);

test(
  "spawn errors keep null PIDs and remain failed while retries continue",
  { timeout: 12_000 },
  async () => {
    const data = mkdtempSync(join(tmpdir(), "arcmap-spawn-error-"));
    const preload = join(data, "spawn-error.cjs");
    writeFileSync(preload, "const cp=require('node:child_process');const original=cp.spawn;cp.spawn=(command,args,options)=>original('/nonexistent-arcmap-node',args,options);require('node:module').syncBuiltinESMExports();");
    const db = join(data, "worker-status.sqlite");
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/workers.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_OPTIONS: `--require=${preload}`, ARCMAP_WORKER_STATUS_DB: db },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      await sleep(5500);
      assert.equal(child.exitCode, null, "supervisor must keep retrying");
      const status = new WorkerStatusStore(db);
      const rows = status.listExpected();
      status.close();
      assert.ok(rows.every((row) => row.pid === null));
      assert.ok(rows.every((row) => row.state === "failed"));
      assert.ok(rows.every((row) => row.lastError?.includes("ENOENT")));
    } finally {
      child.kill("SIGTERM");
      await sleep(1200);
      rmSync(data, { recursive: true, force: true });
    }
  },
);

// Thesis quiet-cycle / invent-success behavior is owned by draft PR #2
// (fix/thesis-quiet-cycle-health). Do not assert thesis-worker → WorkerStatus
// wiring here until that slice lands or a later stacked PR owns it.
