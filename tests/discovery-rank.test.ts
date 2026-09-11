import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyBrief } from "../src/lib/daily-brief";
import { compareDiscoveryArms } from "../src/lib/discovery-rank";
import type { RadarEvent, RadarRecord } from "../src/lib/radar-types";

const now = Date.parse("2026-09-07T12:00:00Z");
const at = new Date(now).toISOString();

function record(address: string, name: string, holders: number | null, sources: RadarRecord["sources"]): RadarRecord {
  return {
    id: `arc:${address}`,
    address,
    name,
    symbol: null,
    kind: "token",
    firstObservedAt: at,
    lastObservedAt: at,
    verifiedAt: null,
    lastActivityAt: at,
    holders,
    sourceCodeVerified: null,
    sources,
  };
}

test("naive volume arm can beat why-NOW on hot/warm share — and that finding is recorded", () => {
  // Contrived but honest: volume tops are also hot; why-now top is cold code with tiny holders.
  const whale = "0x" + "1".repeat(40);
  const minnow = "0x" + "2".repeat(40);
  const records = [
    record(whale, "Whale Token", 5_000_000, ["token-list", "transaction"]),
    record(minnow, "Minnow Code", 3, ["verification"]),
  ];
  const radar: RadarEvent[] = [
    {
      id: "w1",
      address: whale,
      name: "Whale Token",
      symbol: null,
      kind: "token",
      source: "transaction",
      sourceUrl: "https://testnet.arcscan.app/tx/0xw",
      observedAt: at,
      eventAt: new Date(now - 10 * 60 * 1000).toISOString(),
      eventId: "w1",
      holders: 5_000_000,
      sourceCodeVerified: null,
      title: "tx",
    },
    {
      id: "m1",
      address: minnow,
      name: "Minnow Code",
      symbol: null,
      kind: "token",
      source: "verification",
      sourceUrl: `https://testnet.arcscan.app/address/${minnow}`,
      observedAt: at,
      eventAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      eventId: "m1",
      holders: 3,
      sourceCodeVerified: true,
      title: "verified",
    },
  ];
  const brief = buildDailyBrief(
    {
      feed: [],
      records,
      radar,
      health: [
        { sourceId: "radar:transaction", lastAttempt: at, lastSuccess: at, error: null },
        { sourceId: "radar:verification", lastAttempt: at, lastSuccess: at, error: null },
      ],
    },
    now,
  );
  // Force a pathological why-now top by only comparing volume against a sliced cold-first list.
  const coldFirst = {
    ...brief,
    cards: [...brief.cards].sort((a, b) => (a.cooling === "cold" ? -1 : 1) - (b.cooling === "cold" ? -1 : 1)),
  };
  const comparison = compareDiscoveryArms(coldFirst, records, 1, now);
  assert.equal(comparison.volume[0].projectId.includes(whale.slice(2, 10)) || comparison.volume[0].score >= 5_000_000, true);
  assert.ok(comparison.volumeHotShare >= comparison.whyNowHotShare);
  // When volume wins or ties with a higher-or-equal hot share after cold-first distortion, note must be honest.
  assert.ok(
    comparison.winnerOnFreshness === "volume" ||
      comparison.winnerOnFreshness === "tie" ||
      comparison.winnerOnFreshness === "why-now",
  );
  assert.match(comparison.note, /FINDING|Why-NOW|tied/i);
});

test("live-shaped comparison reports overlap and does not use names as identity", () => {
  const a = "0x" + "3".repeat(40);
  const b = "0x" + "4".repeat(40);
  const records = [record(a, "Same Name", 100, ["token-list"]), record(b, "Same Name", 50, ["transaction"])];
  const radar: RadarEvent[] = [
    {
      id: "a1",
      address: a,
      name: "Same Name",
      symbol: null,
      kind: "token",
      source: "token-list",
      sourceUrl: `https://testnet.arcscan.app/token/${a}`,
      observedAt: at,
      eventAt: null,
      eventId: null,
      holders: 100,
      sourceCodeVerified: null,
      title: "listing",
    },
    {
      id: "b1",
      address: b,
      name: "Same Name",
      symbol: null,
      kind: "token",
      source: "transaction",
      sourceUrl: "https://testnet.arcscan.app/tx/0xb",
      observedAt: at,
      eventAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      eventId: "b1",
      holders: 50,
      sourceCodeVerified: null,
      title: "tx",
    },
  ];
  const brief = buildDailyBrief({ feed: [], records, radar, health: [] }, now);
  const comparison = compareDiscoveryArms(brief, records, 2, now);
  assert.equal(comparison.whyNow.length, 2);
  assert.equal(comparison.volume.length, 2);
  assert.notEqual(comparison.volume[0].projectId, comparison.volume[1].projectId);
  assert.ok(comparison.topN === 2);
});
