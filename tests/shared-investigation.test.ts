import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MissionStore } from "../src/lib/mission-store";
import type { Mission, MissionReport } from "../src/lib/hunters";
import { lastHuntReturn } from "../src/lib/last-hunt-return";

const REPORT: MissionReport = {
  version: 1,
  hunter: "distribution",
  thesis: "Does the sample extend beyond one transaction?",
  conclusion: "The bounded sample contains more than one transaction.",
  stance: "limited-support",
  provider: "explorer",
  source: "test fixture",
  observedAt: "2026-09-06T20:00:00.000Z",
  indexedBlock: null,
  sampleSize: 2,
  transactions: 2,
  firstEventAt: "2026-09-06T18:00:00.000Z",
  lastEventAt: "2026-09-06T19:00:00.000Z",
  evidence: [
    {
      transaction: `0x${"a".repeat(64)}`,
      block: 1,
      from: `0x${"1".repeat(40)}`,
      to: `0x${"2".repeat(40)}`,
      timestamp: "2026-09-06T18:00:00.000Z",
      logIndex: 0,
    },
    {
      transaction: `0x${"b".repeat(64)}`,
      block: 2,
      from: `0x${"3".repeat(40)}`,
      to: `0x${"4".repeat(40)}`,
      timestamp: "2026-09-06T19:00:00.000Z",
      logIndex: 0,
    },
  ],
  observations: ["Two distinct transactions were returned."],
  limitations: ["This fixture is not a complete activity history."],
  steps: [{ tool: "fixture", result: "Two bounded rows." }],
};

function completed(store: MissionStore, owner: string): Mission {
  const mission = store.create(owner, {
    projectId: "sun-token",
    provider: "explorer",
    budget: "0.05",
  });
  store.claim(owner, mission.id);
  return store.finish(owner, mission.id, REPORT, null);
}

test("one investigation is deliberately shared and counterevidence survives restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "arcmap-shared-investigation-"));
  const path = join(dir, "missions.sqlite");
  try {
    const first = new MissionStore(path);
    const shared = completed(first, "researcher-a");
    const privateMission = completed(first, "researcher-a");
    const invite = first.createInvite("researcher-a", shared.id);

    assert.equal(first.listVisible("researcher-b").length, 0);
    assert.throws(
      () => first.acceptInvite("researcher-a", invite.token),
      /separate session/,
    );
    const accepted = first.acceptInvite("researcher-b", invite.token);
    assert.equal(accepted.id, shared.id);
    assert.equal(accepted.collaboration?.role, "contributor");
    assert.deepEqual(
      first.listVisible("researcher-b").map((mission) => mission.id),
      [shared.id],
    );
    assert.equal(first.getVisible("researcher-b", privateMission.id), null);
    assert.equal(first.getVisible("stranger", shared.id), null);
    assert.throws(
      () => first.acceptInvite("stranger", invite.token),
      /already been accepted/,
    );

    const challenged = first.addCounterevidence("researcher-b", shared.id, {
      sourceUrl: "https://example.com/source-record",
      note: "This source shows the two rows belong to one bounded publication event.",
    });
    assert.equal(challenged.collaboration?.counterevidence.length, 1);
    assert.equal(lastHuntReturn([challenged])?.decision, "reassess");
    assert.equal(challenged.reportHash, shared.reportHash);
    assert.deepEqual(challenged.report?.evidence, shared.report?.evidence);
    first.close();

    const returned = new MissionStore(path);
    const ownerView = returned.getVisible("researcher-a", shared.id);
    const contributorView = returned.getVisible("researcher-b", shared.id);
    assert.equal(ownerView?.collaboration?.counterevidence.length, 1);
    assert.equal(contributorView?.collaboration?.counterevidence.length, 1);
    assert.equal(ownerView?.reportHash, shared.reportHash);

    returned.revokeInvite("researcher-a", shared.id);
    assert.equal(returned.getVisible("researcher-b", shared.id), null);
    assert.throws(
      () =>
        returned.addCounterevidence("researcher-b", shared.id, {
          sourceUrl: "https://example.com/after-revocation",
          note: "This contribution must not be accepted after revocation.",
        }),
      /Active contributor access/,
    );
    assert.equal(
      returned.getVisible("researcher-a", shared.id)?.collaboration
        ?.counterevidence.length,
      1,
    );
    returned.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("counterevidence requires a bounded public source and note", () => {
  const store = new MissionStore(":memory:");
  try {
    const mission = completed(store, "owner");
    const invite = store.createInvite("owner", mission.id);
    store.acceptInvite("contributor", invite.token);
    for (const sourceUrl of [
      "not a url",
      "file:///private/night-plan",
      "http://127.0.0.1/private",
      "https://user:secret@example.com/evidence",
    ])
      assert.throws(() =>
        store.addCounterevidence("contributor", mission.id, {
          sourceUrl,
          note: "A sufficiently specific sourced challenge.",
        }),
      );
    assert.throws(
      () =>
        store.addCounterevidence("contributor", mission.id, {
          sourceUrl: "https://example.com/evidence",
          note: "short",
        }),
      /10–500/,
    );
  } finally {
    store.close();
  }
});
