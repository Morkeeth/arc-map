import test from "node:test";
import assert from "node:assert/strict";
import { coolingFromAgeMs, deriveWhyNow, COOLING_BANDS_MS } from "../src/lib/why-now";
import { buildDailyBrief } from "../src/lib/daily-brief";
import type { RadarEvent, RadarRecord } from "../src/lib/radar-types";

const now = Date.parse("2026-09-07T10:00:00Z");

test("cooling bands are derived from signal age, never from a prompt figure", () => {
  assert.equal(coolingFromAgeMs(null), "unknown");
  assert.equal(coolingFromAgeMs(-1), "unknown");
  assert.equal(coolingFromAgeMs(COOLING_BANDS_MS.hot - 1), "hot");
  assert.equal(coolingFromAgeMs(COOLING_BANDS_MS.hot), "warm");
  assert.equal(coolingFromAgeMs(COOLING_BANDS_MS.warm), "cooling");
  assert.equal(coolingFromAgeMs(COOLING_BANDS_MS.cooling), "cold");
});

test("why-now prefers original event clocks over observation/retrieval time", () => {
  const observedAt = "2026-09-07T09:59:00Z";
  const oldEvent = "2026-08-28T12:00:00Z";
  const clock = deriveWhyNow({
    now,
    observedAt,
    firstEventAt: oldEvent,
    lastEventAt: oldEvent,
    kind: "code",
  });
  assert.equal(Date.parse(clock.signalAt!), Date.parse(oldEvent));
  assert.equal(clock.cooling, "cold");
  assert.match(clock.whyNow, /older than a day/);
  assert.ok(clock.signalAgeMs !== null);
  assert.equal(clock.signalAgeMs, now - Date.parse(oldEvent));
});

test("future or invalid event stamps do not invent a hot signal", () => {
  const clock = deriveWhyNow({
    now,
    observedAt: "2026-09-07T09:59:00Z",
    firstEventAt: "2026-09-07T11:00:00Z",
    lastEventAt: "not-a-date",
    kind: "activity",
  });
  assert.equal(clock.cooling, "unknown");
  assert.equal(clock.signalAt, null);
});

test("hot on-chain activity outranks cold code in why-NOW brief order", () => {
  const at = new Date(now).toISOString();
  const hotAddr = "0x" + "a".repeat(40);
  const coldAddr = "0x" + "b".repeat(40);
  const hotRecord: RadarRecord = {
    id: `arc:${hotAddr}`,
    address: hotAddr,
    name: "Hot Contract",
    symbol: null,
    kind: "contract",
    firstObservedAt: at,
    lastObservedAt: at,
    verifiedAt: null,
    lastActivityAt: at,
    holders: 2,
    sourceCodeVerified: null,
    sources: ["transaction"],
  };
  const coldRecord: RadarRecord = {
    ...hotRecord,
    id: `arc:${coldAddr}`,
    address: coldAddr,
    name: "Cold Verified",
    holders: 9_000_000,
    sources: ["verification"],
  };
  const hotEvent: RadarEvent = {
    id: "hot-tx",
    address: hotAddr,
    name: hotRecord.name,
    symbol: null,
    kind: "contract",
    source: "transaction",
    sourceUrl: "https://testnet.arcscan.app/tx/0x1",
    observedAt: at,
    eventAt: new Date(now - 5 * 60 * 1000).toISOString(),
    eventId: "hot-tx",
    holders: 2,
    sourceCodeVerified: null,
    title: "Contract activity observed",
  };
  const coldEvent: RadarEvent = {
    id: "cold-ver",
    address: coldAddr,
    name: coldRecord.name,
    symbol: null,
    kind: "contract",
    source: "verification",
    sourceUrl: `https://testnet.arcscan.app/address/${coldAddr}`,
    observedAt: at,
    eventAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
    eventId: "cold-ver",
    holders: 9_000_000,
    sourceCodeVerified: true,
    title: "Source verified",
  };
  const brief = buildDailyBrief(
    {
      feed: [],
      records: [hotRecord, coldRecord],
      radar: [hotEvent, coldEvent],
      health: [
        {
          sourceId: "radar:transaction",
          lastAttempt: at,
          lastSuccess: at,
          error: null,
        },
        {
          sourceId: "radar:verification",
          lastAttempt: at,
          lastSuccess: at,
          error: null,
        },
      ],
    },
    now,
  );
  assert.equal(brief.cards.length, 2);
  assert.equal(brief.cards[0].cooling, "hot");
  assert.equal(brief.cards[0].kind, "activity");
  assert.equal(brief.cards[1].cooling, "cold");
  assert.equal(brief.cards[1].kind, "code");
  assert.match(brief.ranking, /Why-NOW/);
  assert.match(brief.cards[0].whyNow, /last hour/i);
});
