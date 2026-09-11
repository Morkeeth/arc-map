import type { Mission } from "./hunters";

/** Prefer an explicit mission id, else the newest terminal Hunt for return visits. */
export function missionForReturn(
  missions: Mission[],
  preferredId?: string | null,
): Mission | null {
  if (preferredId) {
    const exact = missions.find((mission) => mission.id === preferredId);
    return exact ?? null;
  }
  return (
    missions.find(
      (mission) =>
        mission.status === "reported" || mission.status === "blocked",
    ) || null
  );
}
