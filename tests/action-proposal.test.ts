import test from "node:test";
import assert from "node:assert/strict";
import { actionProposalFor } from "../src/lib/action-proposal";
import type { MissionReport } from "../src/lib/hunters";

function report(partial: Partial<MissionReport>): MissionReport {
  return {
    version: 1,
    hunter: "distribution",
    thesis: "Does the sampled transfer activity extend beyond a single distribution transaction?",
    conclusion: "Fixture conclusion.",
    stance: "limited-support",
    provider: "explorer",
    source: "test fixture",
    observedAt: "2026-09-07T10:00:00Z",
    indexedBlock: null,
    sampleSize: 4,
    transactions: 2,
    firstEventAt: "2026-09-07T09:00:00Z",
    lastEventAt: "2026-09-07T09:30:00Z",
    evidence: [
      {
        transaction: "0x" + "1".repeat(64),
        block: 1,
        from: "0x" + "a".repeat(40),
        to: "0x" + "b".repeat(40),
        timestamp: "2026-09-07T09:00:00Z",
        logIndex: 0,
      },
      {
        transaction: "0x" + "2".repeat(64),
        block: 2,
        from: "0x" + "a".repeat(40),
        to: "0x" + "c".repeat(40),
        timestamp: "2026-09-07T09:30:00Z",
        logIndex: 0,
      },
    ],
    observations: [],
    limitations: [],
    steps: [],
    ...partial,
  };
}

test("limited-support unlocks an inspectable non-financial action proposal", () => {
  const proposal = actionProposalFor(report({}), "0x" + "d".repeat(40));
  assert.equal(proposal.status, "ready");
  assert.ok(proposal.checklist.length >= 4);
  assert.ok(proposal.checklist.some((s) => /fork simulation/i.test(s.label)));
  assert.ok(proposal.forbidden.some((f) => /mainnet|testnet funds/i.test(f)));
  assert.equal(proposal.basedOn.transactions, 2);
  assert.ok(!proposal.checklist.some((s) => /approve|fund|wallet send/i.test(s.label)));
});

test("unsupported and insufficient stances withhold action proposals", () => {
  for (const stance of ["not-supported", "insufficient-evidence"] as const) {
    const proposal = actionProposalFor(report({ stance, transactions: stance === "not-supported" ? 1 : 0, sampleSize: stance === "not-supported" ? 3 : 0, evidence: [] }));
    assert.equal(proposal.status, "withheld");
    assert.equal(proposal.checklist.length, 0);
    assert.match(proposal.summary, /Do not/i);
  }
});
