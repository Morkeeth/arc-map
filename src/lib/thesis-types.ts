export type ThesisMetric = "transfer-counter" | "holder-counter" | "repository-head" | "transaction-counter";
export type ThesisSample = {
  metric: ThesisMetric; observedAt: string; sourceUrl: string;
  value: number | string; sourceEventAt: string | null;
};
export type Thesis = {
  id: string; projectId: string; projectName: string; claim: string; metric: ThesisMetric;
  threshold: number; createdAt: string; deadline: string; commitment: string;
  baseline: ThesisSample; status: "tracking" | "observed" | "not-observed" | "inconclusive" | "cancelled";
  intervalMinutes: number; remainingChecks: number; nextCheckAt: string | null;
  lastCheckAt: string | null;
};
export type ThesisCheck = {
  id: number; thesisId: string; checkedAt: string; sample: ThesisSample | null;
  error: string | null; observation: string; met: boolean;
};
