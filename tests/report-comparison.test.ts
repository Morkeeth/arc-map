import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MissionStore } from "../src/lib/mission-store";
import { compareReports } from "../src/lib/report-comparison";
import type { MissionReport } from "../src/lib/hunters";

const report: MissionReport = {
  version: 1,
  hunter: "distribution",
  thesis:
    "Does the sampled transfer activity extend beyond a single distribution transaction?",
  provider: "explorer",
  source: "Explicit labeled test fixture",
  observedAt: "2026-09-05T00:00:00Z",
  indexedBlock: null,
  sampleSize: 50,
  transactions: 1,
  firstEventAt: "2026-09-04T00:00:00Z",
  lastEventAt: "2026-09-04T00:00:00Z",
  stance: "not-supported",
  conclusion: "One sampled transaction.",
  evidence: [],
  observations: [],
  limitations: ["Bounded labeled fixture, not live provider evidence."],
  steps: [],
};
const input = {
  projectId: "sun-token",
  provider: "explorer",
  budget: "0.05",
};

function finish(
  store: MissionStore,
  owner: string,
  missionId: string,
  result: MissionReport | null,
  error: string | null = null,
) {
  store.claim(owner, missionId);
  return store.finish(owner, missionId, result, error);
}

test("unchanged revisit ignores retrieval time and bounded count changes alone", () => {
  const store = new MissionStore(":memory:");
  try {
    const first = store.create("a", input);
    const before = finish(store, "a", first.id, report);
    assert.throws(
      () => store.create("b", { ...input, previousMissionId: first.id }),
      /workspace/,
    );
    assert.throws(
      () =>
        store.create("a", {
          ...input,
          provider: "graph",
          previousMissionId: first.id,
        }),
      /same/,
    );
    const second = store.create("a", {
      ...input,
      previousMissionId: first.id,
    });
    assert.throws(
      () => compareReports(before, second),
      /still in progress/,
    );
    const after = finish(store, "a", second.id, {
      ...report,
      observedAt: "2026-09-05T00:30:00Z",
      sampleSize: 200,
    });
    const compared=compareReports(before,after);
    assert.equal(compared.evidenceChange, "unchanged");
    assert.equal(compared.conclusionImpact, "unchanged");
    assert.match(compared.finding, /Retrieval time alone is not evidence/);
    assert.equal(compared.samples.before.events, 50);
    assert.equal(compared.samples.after?.events, 200);
    assert.match(compared.coverage.label, /Arcscan explorer sample/);
    assert.match(compared.limitations[0], /not growth rates/);
    assert.equal(store.get("a", first.id)?.reportHash, before.reportHash);
    assert.throws(
      () =>
        compareReports(before, {
          ...after,
          report: { ...after.report!, transactions: 999 },
        }),
      /commitment/,
    );
    assert.throws(() => compareReports(after, before), /later mission/);
  } finally {
    store.close();
  }
});

test("changed revisit separates new support, counterevidence and conclusion impact", () => {
  const store = new MissionStore(":memory:");
  try {
    const first = store.create("a", input);
    const before = finish(store, "a", first.id, report);
    const second = store.create("a", {
      ...input,
      previousMissionId: first.id,
    });
    const newReport: MissionReport = {
      ...report,
      observedAt: "2026-09-05T00:30:00Z",
      lastEventAt: "2026-09-05T00:10:00Z",
      transactions: 2,
      stance: "limited-support",
      conclusion: "Two sampled transactions.",
      evidence: [
        {
          transaction: `0x${"1".repeat(64)}`,
          block: 1,
          from: `0x${"2".repeat(40)}`,
          to: `0x${"3".repeat(40)}`,
          timestamp: "2026-09-05T00:10:00Z",
          logIndex: 0,
        },
      ],
      observations: ["Both samples can still reflect one operator."],
      limitations: [
        ...report.limitations,
        "Sender addresses are not proof of independent users.",
      ],
    };
    const after = finish(store, "a", second.id, newReport);
    const changed = compareReports(before, after);
    assert.equal(changed.evidenceChange, "changed");
    assert.equal(changed.conclusionImpact, "changed");
    assert.equal(changed.activityAfterBaseline, true);
    assert.match(changed.newSupportingEvidence.join(" "), /after the baseline/);
    assert.match(changed.newCounterevidence.join(" "), /one operator/);
    assert.match(changed.nextAction.href, /testnet\.arcscan\.app\/tx/);
  } finally {
    store.close();
  }
});

test("unavailable source keeps the baseline and returns an insufficient-data revisit", () => {
  const store = new MissionStore(":memory:");
  try {
    const first = store.create("a", input);
    const before = finish(store, "a", first.id, report);
    const second = store.create("a", {
      ...input,
      previousMissionId: first.id,
    });
    const blocked = finish(
      store,
      "a",
      second.id,
      null,
      "Contract activity source unavailable.",
    );
    const compared = compareReports(before, blocked);
    assert.equal(compared.retrieval.status, "unavailable");
    assert.equal(compared.evidenceChange, "insufficient-data");
    assert.equal(compared.conclusionImpact, "insufficient-data");
    assert.equal(compared.currentReportHash, null);
    assert.match(compared.newCounterevidence[0], /source unavailable/i);
    assert.match(compared.nextAction.detail, /does not authorize substitution/);
    assert.equal(store.get("a", first.id)?.reportHash, before.reportHash);
  } finally {
    store.close();
  }
});

test("revisit comparison survives a mission-store restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "arcmap-revisit-"));
  const path = join(directory, "missions.sqlite");
  try {
    const firstStore = new MissionStore(path);
    const first = firstStore.create("a", input);
    const before = finish(firstStore, "a", first.id, report);
    const second = firstStore.create("a", {
      ...input,
      previousMissionId: first.id,
    });
    const after = finish(firstStore, "a", second.id, {
      ...report,
      observedAt: "2026-09-05T00:30:00Z",
    });
    firstStore.close();

    const restarted = new MissionStore(path);
    const reopenedBefore = restarted.get("a", before.id)!;
    const reopenedAfter = restarted.get("a", after.id)!;
    const compared = compareReports(reopenedBefore, reopenedAfter);
    assert.equal(compared.evidenceChange, "unchanged");
    assert.equal(compared.previousReportHash, before.reportHash);
    assert.equal(compared.currentReportHash, after.reportHash);
    restarted.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
