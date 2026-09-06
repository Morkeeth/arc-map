import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ThesisStore } from "../src/lib/thesis-store";
import { WorkerStatusStore } from "../src/lib/worker-status";
import { cycle } from "../scripts/thesis-worker";

// Fault-injection fixtures exercise the actual worker and persisted checks.
// No external provider is called and no fixture is presented as live research.
test("source failure survives idle/restart and another thesis; only its own retry clears it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arcmap-worker-test-"));
  const db = join(dir, "theses.sqlite"), status = join(dir, "status.json");
  const workerDb = join(dir, "worker-status.sqlite");
  const oldEnv = process.env.ARCMAP_THESES_DB, oldFetch = globalThis.fetch;
  const oldWorker = process.env.ARCMAP_WORKER_STATUS_DB;
  process.env.ARCMAP_THESES_DB = db;
  process.env.ARCMAP_WORKER_STATUS_DB = workerDb;
  const create = (owner: string, checks: number) => {
    const store = new ThesisStore();
    try {
      const now = Date.now();
      return store.create(owner, { projectId: "sun-token", claim: "The transfer counter increases during this window.", metric: "transfer-counter", threshold: 10, hours: 1, intervalMinutes: 15, checks },
        { metric: "transfer-counter", observedAt: new Date(now).toISOString(), sourceUrl: "https://testnet.arcscan.app", value: 100, sourceEventAt: null });
    } finally { store.close(); }
  };
  const makeDue = (id: string) => {
    // Advance the stored schedule for a bounded test, not the production allowance.
    const sql = new DatabaseSync(db);
    const row = sql.prepare("SELECT data FROM theses WHERE id=?").get(id)!;
    const item = JSON.parse(String(row.data));
    item.nextCheckAt = new Date(Date.now() - 1).toISOString();
    item.lastCheckAt = null;
    sql.prepare("UPDATE theses SET data=?,next_at=? WHERE id=?").run(JSON.stringify(item), Date.now() - 1, id);
    sql.close();
  };
  const thesesRow = () => {
    const workers = new WorkerStatusStore(workerDb);
    try {
      return workers.listExpected().find((row) => row.name === "theses")!;
    } finally {
      workers.close();
    }
  };
  try {
    const quiet = await cycle(status);
    assert.equal(quiet.cycle, "idle"); assert.equal(quiet.lastSuccess, null);
    const thesis = create("owner-a", 2); makeDue(thesis.id);
    globalThis.fetch = async () => { throw new Error("Injected provider failure"); };
    const failed = await cycle(status);
    assert.equal(failed.failed, 1); assert.equal(failed.checked, 0);
    assert.equal(failed.lastSuccess, null); assert.ok(failed.lastError);
    assert.equal(thesesRow().state, "failed");
    assert.equal(thesesRow().lastSuccess, null);
    const store = new ThesisStore();
    assert.equal(store.checks("owner-a", thesis.id)[0].sample, null);
    assert.equal(store.get("owner-a", thesis.id)?.remainingChecks, 1); store.close();

    const idle = await cycle(status); // cycle reopens stores/status, as after restart
    assert.equal(idle.cycle, "idle"); assert.equal(idle.lastError, failed.lastError);
    assert.equal(idle.lastSuccess, null);
    assert.equal(thesesRow().state, "failed");

    const other = create("owner-b", 1); makeDue(other.id);
    globalThis.fetch = async () => new Response(JSON.stringify({ transfers_count: "101" }));
    const unrelated = await cycle(status);
    assert.equal(unrelated.checked, 1); assert.ok(unrelated.lastError);
    assert.equal(unrelated.lastSuccess, null);
    assert.deepEqual(unrelated.unresolvedChecks, [thesis.id]);
    assert.equal(thesesRow().state, "failed");
    assert.equal(thesesRow().lastSuccess, null);

    makeDue(thesis.id);
    const recovered = await cycle(status);
    assert.equal(recovered.checked, 1); assert.equal(recovered.failed, 0);
    assert.equal(recovered.lastError, null); assert.ok(recovered.lastSuccess);
    assert.deepEqual(recovered.unresolvedChecks, []);
    assert.equal(thesesRow().state, "running");
    assert.ok(thesesRow().lastSuccess);
    const after = await cycle(status);
    assert.equal(after.cycle, "idle"); assert.equal(after.lastSuccess, recovered.lastSuccess);
    const final = new ThesisStore();
    assert.equal(final.checks("owner-a", thesis.id).length, 2);
    assert.equal(final.get("owner-a", thesis.id)?.remainingChecks, 0);
    final.close();
    assert.equal(JSON.parse(readFileSync(status, "utf8")).lastSuccess, recovered.lastSuccess);
    writeFileSync(status, "broken JSON");
    await assert.rejects(() => cycle(status), SyntaxError);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldEnv === undefined) delete process.env.ARCMAP_THESES_DB;
    else process.env.ARCMAP_THESES_DB = oldEnv;
    if (oldWorker === undefined) delete process.env.ARCMAP_WORKER_STATUS_DB;
    else process.env.ARCMAP_WORKER_STATUS_DB = oldWorker;
    rmSync(dir, { recursive: true, force: true });
  }
});
