import type { Mission } from "./hunters";

/** Prefer an explicit mission id, else the newest completed Hunt for return visits. */
export function missionForReturn(
  missions: Mission[],
  preferredId?: string | null,
): Mission | null {
  if (preferredId) {
    const exact = missions.find((mission) => mission.id === preferredId);
    if (exact) return exact;
  }
  return (
    missions.find((mission) => mission.status === "reported") ||
    missions.find((mission) => mission.status === "blocked") ||
    null
  );
}
