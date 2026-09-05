export type ThesisMetric = "transfer-counter" | "holder-counter" | "repository-head" | "transaction-counter";
export type ThesisSample = {
  metric: ThesisMetric; observedAt: string; sourceUrl: string;
  value: number | string; sourceEventAt: string | null;
};
export type Thesis = {
  previousThesisId?:string; previousCommitment?:string;
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
export type ThesisResearch = {
  missionId: string; attachedAt: string; reportHash: string;
  report: import("./hunters").MissionReport;
};
export function describeThesisCriterion(thesis:Thesis) {
  if(thesis.metric==="repository-head")return {kind:"head-differs",baseline:thesis.baseline.value,statement:"The default-branch head must differ from the pinned commit before the deadline."};
  const target=Number(thesis.baseline.value)+thesis.threshold;
  return {kind:"increase-from-baseline",baseline:thesis.baseline.value,minimumIncrease:thesis.threshold,absoluteTarget:target,
    statement:`The counter must increase by at least ${thesis.threshold} from ${thesis.baseline.value}, reaching ${target} or more before the deadline. The threshold is an increase, not an absolute target.`};
}
