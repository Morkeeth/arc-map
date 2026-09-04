import test from "node:test";
import assert from "node:assert/strict";
import { assessIndexFreshness } from "../src/lib/index-freshness";
// Pin the clock. Successful queries with historical data must not unlock funding.
const baseline = { now: 1800000000, chainTimestamp: 1800000000, indexedTimestamp: 1799999990, chainBlock: 1000, indexedBlock: 980 };
test("fresh index is eligible subject to transaction simulation", () => {
  assert.equal(assessIndexFreshness(baseline).fresh, true);
});
test("a reachable Graph endpoint with historical data cannot fund", () => {
  const result = assessIndexFreshness({ ...baseline, indexedTimestamp: baseline.now - 301 });
  assert.equal(result.fresh, false);
  assert.match(result.reason!, /historical/);
});
test("stale RPC cannot make a similarly stale index look current", () => {
  assert.equal(assessIndexFreshness({ ...baseline, now: baseline.now + 121 }).fresh, false);
});
test("future blocks, future timestamps and invalid observations fail closed", () => {
  for (const input of [{ ...baseline, indexedBlock: 1001 }, { ...baseline, indexedTimestamp: baseline.now + 1 }, { ...baseline, indexedBlock: NaN }, { ...baseline, indexedTimestamp: -1 }])
    assert.equal(assessIndexFreshness(input).fresh, false);
});
