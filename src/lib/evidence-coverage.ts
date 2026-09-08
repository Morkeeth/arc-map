import { stableId } from "./stable-id";
import { graphCovers } from "./projects";
import type { Mission, MissionReport } from "./hunters";

export const COVERAGE_MAX_AGE_MS = 15 * 60_000;

export type EvidenceCoverageStatus =
  | "supported"
  | "unsupported"
  | "stale"
  | "counterevidence-heavy";

export type EvidenceCoverageAssessment = {
  status: EvidenceCoverageStatus;
  funding: "eligible" | "withheld";
  reason: string;
  neededEvidence: string[];
  evaluatedAt: string;
};

export type CoverageDecisionReceipt = EvidenceCoverageAssessment & {
  version: 1;
  id: string;
  address: string;
  provider: MissionReport["provider"];
  reportHash: string;
  reportObservedAt: string;
};

const COVERAGE_REQUIREMENTS = [
  "Deploy and verify a Transfer-schema Graph index that includes this exact contract address; the current deployed index covers SUN only.",
  "Run a new Graph Distribution Hunter report with a retained indexed block, sample size, event window, source links and limitations.",
  "Confirm the Graph index is fresh against a current Arc RPC block at funding preparation.",
  "Require a limited-support result after reviewing concentration, repeated-operator and distribution counterevidence.",
];

export function assessEvidenceCoverage(
  mission: Pick<Mission, "address" | "provider" | "report">,
  now = Date.now(),
): EvidenceCoverageAssessment {
  const evaluatedAt = new Date(now).toISOString();
  const report = mission.report;

  if (
    mission.provider !== "graph" ||
    !graphCovers(mission.address) ||
    report?.provider !== "graph"
  ) {
    return {
      status: "unsupported",
      funding: "withheld",
      reason:
        "Funding withheld: this contract is outside the deployed Graph transfer index. Explorer evidence remains inspectable but is not relabeled as Graph coverage.",
      neededEvidence: [...COVERAGE_REQUIREMENTS],
      evaluatedAt,
    };
  }

  const observedAt = report ? Date.parse(report.observedAt) : Number.NaN;
  if (
    !Number.isFinite(observedAt) ||
    observedAt > now ||
    now - observedAt > COVERAGE_MAX_AGE_MS
  ) {
    return {
      status: "stale",
      funding: "withheld",
      reason:
        "Funding withheld: the Graph report is older than the 15-minute evidence window (or has an invalid observation time). Run a new mission; do not refresh this receipt in place.",
      neededEvidence: [
        "Run a new Graph mission for the same exact contract.",
        "Retain a fresh observation time and indexed block, then compare it with current Arc RPC state.",
      ],
      evaluatedAt,
    };
  }

  if (report.stance !== "limited-support") {
    return {
      status: "counterevidence-heavy",
      funding: "withheld",
      reason:
        report.stance === "not-supported"
          ? "Funding withheld: the returned sample does not support activity beyond one transaction; counterevidence outweighs the proposed action."
          : "Funding withheld: the source returned too little evidence to assess the thesis, so uncertainty outweighs the proposed action.",
      neededEvidence: [
        "Run a new bounded Graph sample that supports activity across more than one distinct transaction.",
        "Retain the event window and inspect whether activity is minting, distribution follow-up, testing or repeated automation.",
      ],
      evaluatedAt,
    };
  }

  return {
    status: "supported",
    funding: "eligible",
    reason:
      "The exact contract has fresh Graph coverage and a limited-support report. This permits policy preparation only; wallet, chain, escrow and receipt checks still apply.",
    neededEvidence: [],
    evaluatedAt,
  };
}

export function coverageDecisionReceipt(
  mission: Pick<Mission, "address" | "provider" | "report">,
  reportHash: string,
  now = Date.now(),
): CoverageDecisionReceipt {
  if (!mission.report) throw new Error("A completed report is required.");
  const assessment = assessEvidenceCoverage(mission, now);
  const facts = {
    version: 1 as const,
    ...assessment,
    address: mission.address,
    provider: mission.report.provider,
    reportHash,
    reportObservedAt: mission.report.observedAt,
  };
  return {
    ...facts,
    id: `coverage-${stableId(JSON.stringify(facts))}`,
  };
}
