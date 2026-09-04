import { MissionStore } from "@/lib/mission-store";
import { missionAccess, missionResponse } from "@/lib/mission-access";
import { runHunter } from "@/lib/hunter-runner";
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
  const { id } = await context.params;
  const store = new MissionStore();
  try {
    if (!store.get(access.owner, id))
      return missionResponse(
        { error: "Mission not found." },
        access.cookie,
        404,
      );
    const mission = store.claim(access.owner, id);
    try {
      const report = await runHunter(mission);
      return missionResponse(
        { mission: store.finish(access.owner, id, report, null) },
        access.cookie,
      );
    } catch (error) {
      return missionResponse(
        {
          mission: store.finish(
            access.owner,
            id,
            null,
            error instanceof Error ? error.message : "Research unavailable.",
          ),
        },
        access.cookie,
        502,
      );
    }
  } catch (error) {
    return missionResponse(
      {
        error:
          error instanceof Error ? error.message : "Mission could not run.",
      },
      access.cookie,
      409,
    );
  } finally {
    store.close();
  }
}
