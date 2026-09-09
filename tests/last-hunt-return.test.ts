import test from "node:test";
import assert from "node:assert/strict";
import { lastHuntReturn } from "../src/lib/last-hunt-return";
import type { Mission } from "../src/lib/hunters";

test("Today last-hunt card deep-links reported evidence", () => {
  const mission = {
    id: "0xabc",
    projectId: "sun-token",
    status: "reported",
    report: {
      stance: "limited-support",
      conclusion: "The sample contains more than one transaction.",
      evidence: [
        { transaction: `0x${"a".repeat(64)}` },
        { transaction: `0x${"b".repeat(64)}` },
      ],
    },
  } as Mission;
  const card = lastHuntReturn([mission]);
  assert.ok(card);
  assert.equal(card.href, "/hunters?id=0xabc");
  assert.equal(card.stance, "limited-support");
  assert.equal(card.evidenceCount, 2);
  assert.equal(card.firstEvidenceTx, `0x${"a".repeat(64)}`);
  assert.equal(lastHuntReturn([]), null);
});

test("Today return card retains decisions across a pinned rerun", () => {
  const baseline = {
    id: "0xbase",
    projectId: "sun-token",
    status: "reported",
    report: { evidence: [] },
    policyReview: {
      receipt: {
        id: "policy-one",
        status: "simulated",
        simulatedAt: "2026-09-09T08:00:00.000Z",
      },
    },
  } as Mission;
  const current = {
    id: "0xcurrent",
    previousMissionId: baseline.id,
    projectId: "sun-token",
    status: "reported",
    report: { evidence: [] },
    coverageDecision: {
      id: "coverage-two",
      funding: "eligible",
      evaluatedAt: "2026-09-09T08:10:00.000Z",
      reason: "Fresh Graph coverage.",
    },
  } as Mission;
  const card = lastHuntReturn([current, baseline]);
  assert.equal(card?.decision?.id, "coverage-two");
  assert.equal(card?.baselineDecision?.id, "policy-one");
  assert.equal(card?.hasComparison, true);
});
