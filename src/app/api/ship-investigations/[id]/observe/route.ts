import { missionAccess, missionResponse } from "@/lib/mission-access";
import { ShipStore } from "@/lib/ship-store";
import { inspectReleases, clearReleaseCache } from "@/lib/providers/releases";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let cookie: string | undefined;
  try {
    const access = missionAccess(request, true);
    cookie = access.cookie;
    const { id } = await context.params;
    const store = new ShipStore();
    try {
      const current = store.get(access.owner, id);
      if (!current)
        return missionResponse({ error: "Investigation not found." }, cookie, 404);
      clearReleaseCache();
      try {
        const observation = await inspectReleases(current.projectId);
        if (current.status !== "observed" || !current.observation) {
          const investigation = store.pinObservation(access.owner, id, observation);
          return missionResponse({ investigation, changed: false }, cookie);
        }
        const { investigation, rerun } = store.appendRerun(
          access.owner,
          id,
          observation,
        );
        return missionResponse(
          { investigation, rerun, changed: rerun.changedFromPinned },
          cookie,
        );
      } catch (error) {
        if (current.status === "observed")
          return missionResponse(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Re-observation failed; pinned evidence retained.",
              investigation: current,
            },
            cookie,
            502,
          );
        const investigation = store.block(
          access.owner,
          id,
          error instanceof Error ? error.message : "Release observation failed.",
        );
        return missionResponse({ investigation }, cookie, 502);
      }
    } finally {
      store.close();
    }
  } catch (error) {
    return missionResponse(
      { error: error instanceof Error ? error.message : "Re-observation failed." },
      cookie,
      400,
    );
  }
}
