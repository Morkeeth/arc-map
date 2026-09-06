import type { Mission } from "./hunters";
import { missionForReturn } from "./mission-return";

export type LastHuntReturn = {
  missionId: string;
  projectId: string;
  status: "reported" | "blocked";
  stance: string | null;
  conclusion: string | null;
  evidenceCount: number;
  firstEvidenceTx: string | null;
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
  return {
    missionId: mission.id,
    projectId: mission.projectId,
    status: mission.status,
    stance: mission.report?.stance || null,
    conclusion: mission.report?.conclusion || null,
    evidenceCount: evidence.length,
    firstEvidenceTx: evidence[0]?.transaction || null,
    href: `/hunters?id=${encodeURIComponent(mission.id)}`,
  };
}
