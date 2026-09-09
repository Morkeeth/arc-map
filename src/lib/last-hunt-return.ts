import type { Mission } from "./hunters";
import { missionForReturn } from "./mission-return";
import {
  retainedDecisionFor,
  type RetainedDecision,
} from "./retained-decision";

export type LastHuntReturn = {
  missionId: string;
  projectId: string;
  status: "reported" | "blocked";
  stance: string | null;
  conclusion: string | null;
  evidenceCount: number;
  firstEvidenceTx: string | null;
  decision: RetainedDecision | null;
  baselineDecision: RetainedDecision | null;
  hasComparison: boolean;
  href: string;
};

/** Compact Today card for the newest completed Hunt — deep-links into Hunters. */
export function lastHuntReturn(
  missions: Mission[],
  preferredId?: string | null,
): LastHuntReturn | null {
  const mission = missionForReturn(missions, preferredId);
  if (!mission || (mission.status !== "reported" && mission.status !== "blocked")) {
    return null;
  }
  const evidence = mission.report?.evidence || [];
  const baseline = mission.previousMissionId
    ? missions.find((item) => item.id === mission.previousMissionId)
    : undefined;
  return {
    missionId: mission.id,
    projectId: mission.projectId,
    status: mission.status,
    stance: mission.report?.stance || null,
    conclusion: mission.report?.conclusion || null,
    evidenceCount: evidence.length,
    firstEvidenceTx: evidence[0]?.transaction || null,
    decision: retainedDecisionFor(mission),
    baselineDecision: baseline ? retainedDecisionFor(baseline) : null,
    hasComparison: Boolean(baseline?.report && mission.report),
    href: `/hunters?id=${encodeURIComponent(mission.id)}`,
  };
}
