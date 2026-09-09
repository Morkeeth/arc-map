export type ThesisMetric =
  | "transfer-counter"
  | "holder-counter"
  | "repository-head"
  | "transaction-counter"
  | "graph-transfer-event";
export type ThesisSample = {
  metric: ThesisMetric; observedAt: string; sourceUrl: string;
  value: number | string; sourceEventAt: string | null;
  provenance?: {
    provider: "graph";
    schema: "Transfer";
    chainId: 5042002;
    indexedBlock: number;
    sampleSize: number;
    eventBlock: number;
    eventTransaction: string;
    eventLogIndex: number;
  };
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
  if(thesis.metric==="graph-transfer-event")return {
    kind:"new-graph-transfer",
    baseline:thesis.baseline.value,
    statement:`The Graph must return a Transfer entity for this exact SUN contract after baseline event ${String(thesis.baseline.value)} before the deadline. A later retrieval or indexed block alone does not satisfy the condition.`,
  };
  const target=Number(thesis.baseline.value)+thesis.threshold;
  return {kind:"increase-from-baseline",baseline:thesis.baseline.value,minimumIncrease:thesis.threshold,absoluteTarget:target,
    statement:`The counter must increase by at least ${thesis.threshold} from ${thesis.baseline.value}, reaching ${target} or more before the deadline. The threshold is an increase, not an absolute target.`};
}
