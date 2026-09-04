import { MissionStore } from "@/lib/mission-store";
import { missionAccess, missionResponse } from "@/lib/mission-access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = missionAccess(request);
    const { id } = await context.params;
    const store = new MissionStore();
    try {
      const mission = store.get(access.owner, id);
      return missionResponse(
        mission ? { mission } : { error: "Mission not found." },
        access.cookie,
        mission ? 200 : 404,
      );
    } finally {
      store.close();
    }
  } catch {
    return missionResponse({ error: "Access denied." }, undefined, 403);
  }
}
