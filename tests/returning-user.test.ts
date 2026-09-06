import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FeedStore } from "../src/lib/feed-store";
import { FollowStore } from "../src/lib/follow-store";
import { followedChanges } from "../src/lib/follow-service";

test("returning user sees post-follow source event after store reopen; stranger empty", () => {
  const dir = mkdtempSync(join(tmpdir(), "arcmap-return-"));
  process.env.ARCMAP_DB_PATH = join(dir, "arcmap.sqlite");
  process.env.ARCMAP_MISSIONS_DB = join(dir, "missions.sqlite");
  process.env.ARCMAP_RADAR_DB = join(dir, "radar.sqlite");

  const feed = new FeedStore();
  const follows = new FollowStore();
  const projectId = "arc-node";

  follows.follow("owner-a", projectId, {
    feed: feed.eventHead(),
    radar: 0,
  });
  assert.equal(followedChanges("owner-a").events.length, 0, "baseline quiet");

  const observedAt = "2026-09-06T09:00:00.000Z";
  assert.equal(
    feed.record({
      projectId,
      sourceId: "github:circlefin/arc-node",
      kind: "code",
      sourceUrl: "https://github.com/circlefin/arc-node/commit/1",
      eventAt: observedAt,
      observedAt,
      payload: { commit: "c".repeat(40), message: "returning-user probe" },
    }),
    true,
  );

  feed.close();
  follows.close();

  // Returning session: reopen via followedChanges (new store handles).
  const again = followedChanges("owner-a");
  assert.ok(
    again.events.some((e) => e.projectId === projectId),
    "source-backed change visible after reopen",
  );
  assert.equal(followedChanges("owner-b").follows.length, 0);
  assert.equal(followedChanges("owner-b").events.length, 0);

  rmSync(dir, { recursive: true, force: true });
});
