import test from "node:test";
import assert from "node:assert/strict";
import { asCount, summarizeTransfers } from "../src/lib/analysis";
import type { Transfer } from "../src/lib/types";

const addr = (digit: string) => `0x${digit.repeat(40)}`;
const transaction = `0x${"a".repeat(64)}`;
const base: Transfer = { from: addr("1"), to: addr("2"), transaction, logIndex: 1, block: 123, timestamp: "2026-06-28T22:45:20Z" };
const report = (transfers: Transfer[], extra = {}) => summarizeTransfers({ address: addr("3"), transfers, holderCount: "100001", transferCount: "100001", moreAvailable: true, fetchedAt: "2026-09-04T20:00:00Z", ...extra });

test("unavailable and unsafe counters remain unknown, including blank string", () => {
  for (const value of [null, undefined, "", " ", "1.5", "NaN", "9007199254740993", -1, Infinity]) assert.equal(asCount(value), null);
  assert.equal(asCount("0"), 0);
});

test("one batched distribution does not become 100001 active users or a sybil conclusion", () => {
  const result = report([base, { ...base, to: addr("4"), logIndex: 2 }]);
  assert.equal(result.examined, 2);
  assert.equal(result.uniqueTransactions, 1);
  assert.equal(result.uniqueRecipients, 2);
  assert.equal(result.leadingSenderCount, 2);
  assert.equal(result.moreAvailable, true);
  assert.ok(result.observations.some((text) => text.includes("does not establish common ownership")));
  assert.ok(result.limitation.includes("not a complete transfer history"));
  assert.equal(result.newestTransferAt, base.timestamp);
  assert.notEqual(result.newestTransferAt, result.fetchedAt);
});

test("duplicate event rows do not inflate activity; distinct log indices survive", () => {
  const result = report([base, { ...base, transaction: transaction.toUpperCase() }, { ...base, logIndex: 2 }]);
  assert.equal(result.examined, 2);
});

test("empty page is not proof of no historical activity", () => {
  const result = report([], { holderCount: null, transferCount: null, moreAvailable: false });
  assert.equal(result.holders, null);
  assert.equal(result.transfers, null);
  assert.equal(result.newestTransferAt, null);
  assert.ok(result.observations.some((text) => text.includes("not proof of no historical activity")));
});

test("mint origin is not treated as a controlled sender wallet", () => {
  const result = report([{ ...base, from: addr("0") }]);
  assert.ok(result.observations.some((text) => text.includes("consistent with mint events")));
});
