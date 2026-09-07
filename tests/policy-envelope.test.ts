import test from "node:test";
import assert from "node:assert/strict";
import { actionProposalFor } from "../src/lib/action-proposal";
import {
  evaluatePolicyEnvelope,
  evidenceWithholdReceipt,
  initialPolicyEnvelope,
} from "../src/lib/policy-envelope";
import type { MissionReport } from "../src/lib/hunters";

const address = "0x" + "d".repeat(40);

function report(
  stance: MissionReport["stance"] = "limited-support",
): MissionReport {
  return {
    version: 1,
    hunter: "activity",
    thesis: "Does the returned sample contain successful transactions?",
    conclusion: "The bounded sample contains distinct successful transactions.",
    stance,
    provider: "explorer",
    source: "Arcscan API test fixture",
    observedAt: "2026-09-07T10:00:00Z",
    indexedBlock: null,
    sampleSize: stance === "insufficient-evidence" ? 0 : 4,
    transactions: stance === "limited-support" ? 2 : 0,
    firstEventAt: "2026-09-07T09:00:00Z",
    lastEventAt: "2026-09-07T09:30:00Z",
    evidence: [],
    observations: [],
    limitations: ["Successful calls do not prove independent users."],
    steps: [],
  };
}

test("supported evidence and a passing envelope produce a simulation receipt", () => {
  const proposal = actionProposalFor(report(), address);
  const envelope = initialPolicyEnvelope(proposal);
  const receipt = evaluatePolicyEnvelope({
    proposal,
    envelope,
    proposedAmount: "0.01",
    now: "2026-09-07T11:00:00Z",
  });

  assert.equal(receipt.status, "simulated");
  assert.equal(receipt.stopReason, null);
  assert.equal(receipt.action?.target, address);
  assert.equal(receipt.envelope?.counterevidenceRef, report().limitations[0]);
  assert.match(receipt.limit, /No signing.*broadcast occurred/);
});

test("truth guard withholds when a required counterevidence field is empty", () => {
  const proposal = actionProposalFor(report(), address);
  const envelope = {
    ...initialPolicyEnvelope(proposal),
    counterevidenceRef: " ",
  };
  const receipt = evaluatePolicyEnvelope({
    proposal,
    envelope,
    proposedAmount: "0.01",
    now: "2026-09-07T11:00:00Z",
  });

  assert.equal(receipt.status, "withheld");
  assert.equal(receipt.action, null);
  assert.equal(receipt.stopReason?.field, "counterevidence");
  assert.match(receipt.stopReason?.message ?? "", /required/i);
});

test("unsupported evidence is withheld before an envelope is attached", () => {
  const proposal = actionProposalFor(
    report("insufficient-evidence"),
    address,
  );
  const receipt = evidenceWithholdReceipt(
    proposal,
    "2026-09-07T10:00:00Z",
  );

  assert.equal(receipt.status, "withheld");
  assert.equal(receipt.envelope, null);
  assert.equal(receipt.stopReason?.field, "evidenceThreshold");
  assert.match(receipt.stopReason?.message ?? "", /insufficient evidence/i);
});
