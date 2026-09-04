import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FeedStore } from "../src/lib/feed-store";
import type { Observation } from "../src/lib/feed-types";
import { ingest } from "../src/lib/ingest";

const observation = (
  time: number,
  holders: number | null = 100,
): Observation => ({
  projectId: "sun-token",
  sourceId: "arc-testnet:test",
  kind: "onchain",
  observedAt: new Date(Date.UTC(2026, 8, 4, 10, time)).toISOString(),
  eventAt: null,
  sourceUrl: "https://testnet.arcscan.app/api/v2/tokens/test/counters",
  payload: { holders, transfers: 100 },
});

test("baseline, unchanged refresh and a real delta remain different; duplicate does not inflate feed", () => {
  const store = new FeedStore(":memory:");
  try {
    assert.equal(store.record(observation(0)), true);
    assert.equal(store.events()[0].kind, "baseline");
    assert.equal(store.record(observation(1)), false);
    assert.equal(store.events().length, 1);
    assert.equal(store.record(observation(2, 101)), true);
    assert.equal(store.events()[0].kind, "onchain");
    assert.equal(store.events()[0].baselineAt, observation(1).observedAt);
    assert.match(store.events()[0].detail, /100 → 101/);
    assert.equal(store.record(observation(2, 101)), false);
    assert.equal(store.events().length, 2);
    assert.equal(store.record(observation(1, 900)), false);
    assert.equal(store.latest("arc-testnet:test")?.payload.holders, 101);
  } finally {
    store.close();
  }
});

test("unknown counts are never converted to zero or narrated as growth", () => {
  const store = new FeedStore(":memory:");
  try {
    store.record(observation(0, null));
    assert.equal(store.record(observation(1, 100)), false);
    assert.match(store.events()[0].detail, /unknown holder/);
  } finally {
    store.close();
  }
});

test("outage preserves last evidence and successful time, then recovery clears error", () => {
  const store = new FeedStore(":memory:");
  try {
    store.record(observation(0));
    store.fail("arc-testnet:test", observation(1).observedAt, "HTTP 503");
    assert.equal(store.health()[0].lastSuccess, observation(0).observedAt);
    assert.equal(store.health()[0].error, "HTTP 503");
    assert.equal(store.events().length, 1);
    store.record(observation(2));
    assert.equal(store.health()[0].error, null);
    assert.equal(store.events().length, 1);
  } finally {
    store.close();
  }
});

test("code history uses source timestamp and stable commit identity across refreshes", () => {
  const store = new FeedStore(":memory:");
  try {
    const row: Observation = {
      ...observation(0),
      kind: "code",
      sourceId: "github:example/repo",
      eventAt: "2026-01-01T00:00:00.000Z",
      payload: { commit: "a".repeat(40), message: "An older real-world shape" },
    };
    store.record(row);
    store.record({ ...row, observedAt: observation(1).observedAt });
    assert.equal(store.events().length, 1);
    assert.equal(store.events()[0].eventAt, row.eventAt);
    assert.equal(store.events()[0].observedAt, row.observedAt);
  } finally {
    store.close();
  }
});

test("database survives reopening and lease prevents concurrent source polling", () => {
  const dir = mkdtempSync(join(tmpdir(), "arcmap-store-test-"));
  const file = join(dir, "test.sqlite");
  try {
    const first = new FeedStore(file);
    first.record(observation(0));
    assert.equal(first.acquireLease(1000), true);
    first.close();
    const second = new FeedStore(file);
    try {
      assert.equal(second.events().length, 1);
      assert.equal(second.acquireLease(2000), false);
      assert.equal(second.acquireLease(61000), true);
    } finally {
      second.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ingestion rejects failed and malformed sources instead of inventing records", async () => {
  const store = new FeedStore(":memory:");
  try {
    const result = await ingest(store, async (url) => {
      if (url.includes("arcscan"))
        return { token_holders_count: "100001", transfers_count: "100001" };
      if (url.includes("arc-node")) throw new Error("Source returned HTTP 503");
      return [{ sha: "not-a-sha", commit: { message: "bad" } }];
    });
    assert.equal(result.checked, 3);
    assert.equal(result.inserted, 1);
    assert.equal(store.health().filter((source) => source.error).length, 2);
    assert.equal(store.events().length, 1);
    assert.equal(
      (
        await ingest(store, async () => {
          throw new Error("Must not run");
        })
      ).skipped,
      true,
    );
  } finally {
    store.close();
  }
});
