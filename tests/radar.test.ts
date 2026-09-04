import test from "node:test";
import assert from "node:assert/strict";
import { parseRadar, ingestRadar } from "../src/lib/radar-ingest";
import { RadarStore } from "../src/lib/radar-store";
import { radarProject } from "../src/lib/research-catalog";
const address = "0x1111111111111111111111111111111111111111";
const at = "2026-09-05T00:00:00.000Z";
test("token page matches live source shape and never infers launch time", () => {
  const [row] = parseRadar("token-list", { items: [{ address_hash: address, name: "Claimed USDC", symbol: "USDC", holders_count: "12" }] }, at);
  assert.equal(row.holders, 12); assert.equal(row.eventAt, null); assert.equal(row.sourceCodeVerified, null);
  const store = new RadarStore(":memory:");
  try { store.record(row); const project = radarProject(store.list()[0]); assert.match(project.relation, /no website/); assert.equal(project.contract, address); }
  finally { store.close(); }
});
test("source verification is a dated event, not deployment or a security audit", () => {
  const [row] = parseRadar("verification", { items: [{ address: { hash: address, name: "Counter", is_verified: true }, verified_at: "2026-09-04T23:00:00Z" }] }, at);
  const store = new RadarStore(":memory:");
  try { store.record(row); assert.equal(store.events()[0].title, "Source code verified on Arcscan"); assert.equal(radarProject(store.list()[0]).researchKind, "contract"); }
  finally { store.close(); }
});
test("repeated polling does not manufacture launches or shift first-observed baseline", () => {
  const [row] = parseRadar("token-list", { items: [{ address_hash: address, name: "Token", holders_count: "3" }] }, at);
  const store = new RadarStore(":memory:");
  try {
    assert.equal(store.record(row), true);
    assert.equal(store.record({ ...row, observedAt: "2026-09-05T00:05:00Z" }), false);
    assert.equal(store.list()[0].firstObservedAt, at); assert.equal(store.events().length, 1);
    assert.equal(store.record({ ...row, observedAt: "2026-09-05T00:10:00Z", holders: 4 }), true);
    assert.equal(store.events().length, 2);
    assert.equal(store.record({ ...row, observedAt: "2026-09-05T00:15:00Z", holders: 3 }), true);
    assert.equal(store.events().length, 3, "A returning counter value is still a new change");
  } finally { store.close(); }
});
test("independent source responses merge even when they finish out of order", () => {
  const store = new RadarStore(":memory:");
  try {
    const [token] = parseRadar("token-list", { items: [{ address_hash: address, name: "Token", holders_count: "12" }] }, at);
    const [verified] = parseRadar("verification", { items: [{ address: { hash: address, name: "Contract", is_verified: true }, verified_at: at }] }, "2026-09-05T00:00:01Z");
    store.record(verified); store.record(token);
    const record = store.list()[0];
    assert.equal(record.kind, "token"); assert.equal(record.holders, 12);
    assert.equal(record.sourceCodeVerified, true); assert.equal(record.firstObservedAt, at);
    assert.equal(record.lastObservedAt, verified.observedAt);
    assert.equal(store.record({ ...token, holders: 0, observedAt: "2026-09-04T23:59:00Z" }), false);
    assert.equal(store.list()[0].holders, 12);
  } finally { store.close(); }
});
test("only successful dated contract transactions enter radar", () => {
  const base = { hash: "0x" + "a".repeat(64), timestamp: at, status: "ok", to: { hash: address, name: "Pool", is_contract: true } };
  assert.equal(parseRadar("transaction", { items: [base, { ...base, status: "error" }, { ...base, to: { ...base.to, is_contract: false } }, { ...base, timestamp: "invalid" }] }, at).length, 1);
});
test("radar outage preserves evidence and reports failure", async () => {
  const store = new RadarStore(":memory:");
  try {
    await ingestRadar(store, async () => { throw new Error("offline"); });
    assert.equal(store.health().length, 3); assert.ok(store.health().every(s => s.error && s.lastSuccess === null));
    assert.equal(store.list().length, 0);
  } finally { store.close(); }
});
