import test from "node:test";
import assert from "node:assert/strict";
import {
  assessEvidenceCoverage,
  coverageDecisionReceipt,
} from "../src/lib/evidence-coverage";
import { projects } from "../src/lib/projects";
import type { MissionReport } from "../src/lib/hunters";

const now = Date.parse("2026-09-08T21:30:00.000Z");
const sun = projects[0].contract!;
const other = "0x1111111111111111111111111111111111111111";

function report(
  partial: Partial<MissionReport> = {},
): MissionReport {
  return {
    version: 1,
    hunter: "distribution",
    thesis: "Does activity extend beyond one transaction?",
    conclusion: "A bounded fixture conclusion.",
    stance: "limited-support",
    provider: "graph",
    source: "Graph fixture",
    observedAt: "2026-09-08T21:29:00.000Z",
    indexedBlock: 61_000_000,
    sampleSize: 2,
    transactions: 2,
    firstEventAt: null,
    lastEventAt: null,
    evidence: [],
    observations: [],
    limitations: ["A sample does not establish independent demand."],
    steps: [],
    ...partial,
  };
}

test("coverage distinguishes supported, unsupported, stale and counterevidence-heavy", () => {
  assert.equal(
    assessEvidenceCoverage(
      { address: sun, provider: "graph", report: report() },
      now,
    ).status,
    "supported",
  );
  const unsupported = assessEvidenceCoverage(
    {
      address: other,
      provider: "explorer",
      report: report({ provider: "explorer", indexedBlock: null }),
    },
    now,
  );
  assert.equal(unsupported.status, "unsupported");
  assert.equal(unsupported.funding, "withheld");
  assert.match(unsupported.reason, /outside the deployed Graph transfer index/i);
  assert.match(unsupported.neededEvidence[0], /exact contract address/i);

  assert.equal(
    assessEvidenceCoverage(
      {
        address: sun,
        provider: "graph",
        report: report({ observedAt: "2026-09-08T21:00:00.000Z" }),
      },
      now,
    ).status,
    "stale",
  );
  assert.equal(
    assessEvidenceCoverage(
      {
        address: sun,
        provider: "graph",
        report: report({ stance: "not-supported", transactions: 1 }),
      },
      now,
    ).status,
    "counterevidence-heavy",
  );
});

test("coverage receipt retains the exact withhold and report commitment", () => {
  const mission = {
    address: other,
    provider: "explorer" as const,
    report: report({ provider: "explorer", indexedBlock: null }),
  };
  const hash = `0x${"a".repeat(64)}`;
  const receipt = coverageDecisionReceipt(mission, hash, now);
  assert.match(receipt.id, /^coverage-[a-f0-9]{24}$/);
  assert.equal(receipt.status, "unsupported");
  assert.equal(receipt.funding, "withheld");
  assert.equal(receipt.reportHash, hash);
  assert.equal(receipt.address, other);
  assert.equal(receipt.evaluatedAt, "2026-09-08T21:30:00.000Z");
});

test("UnitFlow-style explorer limited-support remains funding-withheld (not Graph)", () => {
  const unitFlowish = assessEvidenceCoverage(
    {
      address: other,
      provider: "explorer",
      report: report({
        provider: "explorer",
        stance: "limited-support",
        indexedBlock: null,
        source: "Arcscan fixture",
      }),
    },
    now,
  );
  assert.equal(unitFlowish.funding, "withheld");
  assert.equal(unitFlowish.status, "unsupported");
  assert.doesNotMatch(unitFlowish.reason, /The Graph covered/i);
  assert.match(unitFlowish.reason, /not relabeled as Graph/i);
});
