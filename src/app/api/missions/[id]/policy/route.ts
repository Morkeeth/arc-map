import { MissionStore } from "@/lib/mission-store";
import {
  missionAccess,
  missionResponse,
  readMissionBody,
} from "@/lib/mission-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let access;
  try {
    access = missionAccess(request, true);
  } catch {
    return missionResponse({ error: "Access denied." }, undefined, 403);
  }
  try {
    const input = await readMissionBody(request);
    const { id } = await context.params;
    const store = new MissionStore();
    try {
      const mission = store.savePolicyReview(access.owner, id, input);
      return missionResponse(
        { mission, policyReview: mission.policyReview },
        access.cookie,
      );
    } finally {
      store.close();
    }
  } catch (error) {
    return missionResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Policy review could not be saved.",
      },
      access.cookie,
      400,
    );
  }
}
