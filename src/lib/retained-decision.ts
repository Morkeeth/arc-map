import type { Mission } from "./hunters";

export type RetainedDecision = {
  kind: "policy-simulation" | "coverage";
  id: string;
  status: "simulated" | "withheld" | "eligible";
  retainedAt: string;
  summary: string;
};

/**
 * Prefer the user's saved review decision. Coverage is the fallback decision
 * retained automatically with every completed contract report.
 */
export function retainedDecisionFor(
  mission: Pick<Mission, "policyReview" | "coverageDecision">,
): RetainedDecision | null {
  const policy = mission.policyReview?.receipt;
  if (policy) {
    return {
      kind: "policy-simulation",
      id: policy.id,
      status: policy.status,
      retainedAt: policy.simulatedAt,
      summary:
        policy.status === "simulated"
          ? "The review-only policy envelope passed. No execution occurred."
          : `The review-only policy stopped at ${policy.stopReason?.field ?? "an unknown field"}. No execution occurred.`,
    };
  }

  const coverage = mission.coverageDecision;
  if (!coverage) return null;
  return {
    kind: "coverage",
    id: coverage.id,
    status: coverage.funding,
    retainedAt: coverage.evaluatedAt,
    summary: coverage.reason,
  };
}
