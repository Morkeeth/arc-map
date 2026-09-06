import test from "node:test";
import assert from "node:assert/strict";
import {
  WorkerStatusStore,
  workerFreshness,
  summarizeWorkers,
  EXPECTED_WORKERS,
} from "../src/lib/worker-status";

test("worker lifecycle survives a store reopen and classifies stale cycles", () => {
  const path = `/tmp/arcmap-worker-${process.pid}-${Date.now()}.sqlite`;
  const store = new WorkerStatusStore(path);
  const at = "2026-09-06T06:00:00.000Z";
  store.start("ingest", 42, at);
  store.attempt("ingest", at);
  store.success("ingest", at);
  store.close();
  const reopened = new WorkerStatusStore(path);
  const saved = reopened.list()[0];
  assert.equal(saved.cycles, 1);
  assert.equal(saved.lastSuccess, at);
  assert.equal(
    workerFreshness(saved, Date.parse(at) + 9 * 60_000),
    "running",
  );
  assert.equal(
    workerFreshness(saved, Date.parse(at) + 11 * 60_000),
    "stale",
  );
  reopened.fail("ingest", "source unavailable", "2026-09-06T06:12:00.000Z");
  assert.equal(
    workerFreshness(reopened.list()[0], Date.parse(at) + 12 * 60_000),
    "failed",
  );
  reopened.close();
});

test("a stopped worker is explicit, never fresh", () => {
  const store = new WorkerStatusStore(":memory:");
  store.start("radar", 9);
  store.stop("radar");
  assert.equal(workerFreshness(store.list()[0]), "stopped");
  store.close();
});

test("retry attempts retain a source failure until evidence succeeds", () => {
  const store = new WorkerStatusStore(":memory:");
  store.start("ingest", 1, "2026-09-06T08:00:00.000Z");
  store.success("ingest", "2026-09-06T08:01:00.000Z");
  store.fail("ingest", "provider unavailable", "2026-09-06T08:02:00.000Z");
  store.attempt("ingest", "2026-09-06T08:03:00.000Z");
  let row = store.list()[0];
  assert.equal(row.state, "failed");
  assert.equal(row.lastError, "provider unavailable");
  assert.equal(row.lastSuccess, "2026-09-06T08:01:00.000Z");
  store.start("ingest", 2, "2026-09-06T08:03:30.000Z");
  row = store.list()[0];
  assert.equal(row.state, "failed");
  assert.equal(row.lastError, "provider unavailable");
  store.success("ingest", "2026-09-06T08:04:00.000Z");
  row = store.list()[0];
  assert.equal(row.state, "running");
  assert.equal(row.lastError, null);
  store.close();
});

test("empty store lists expected workers as missing, never all-live", () => {
  const store = new WorkerStatusStore(":memory:");
  const workers = store.listExpected().map((w) => ({
    ...w,
    freshness: workerFreshness(w),
  }));
  assert.equal(workers.length, EXPECTED_WORKERS.length);
  assert.ok(workers.every((w) => w.freshness === "missing"));
  assert.equal(summarizeWorkers(workers), "Missing expected workers");
  store.close();
});

test("standalone attempt registers a row without prior start", () => {
  const store = new WorkerStatusStore(":memory:");
  store.attempt("theses");
  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].name, "theses");
  store.close();
});

test("future lastSuccess is never treated as running", () => {
  const store = new WorkerStatusStore(":memory:");
  const now = Date.parse("2026-09-06T12:00:00.000Z");
  store.start("ingest", 1, "2026-09-06T11:00:00.000Z");
  store.success("ingest", "2026-09-06T18:00:00.000Z");
  assert.equal(workerFreshness(store.list()[0], now), "failed");
  store.close();
});
