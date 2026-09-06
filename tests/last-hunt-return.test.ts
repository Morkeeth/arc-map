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
  assert.equal(card.counterevidenceCount, 0);
  assert.equal(card.decision, "provisional");
  assert.equal(lastHuntReturn([]), null);
});
