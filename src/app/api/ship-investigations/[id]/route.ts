import { missionAccess, missionResponse } from "@/lib/mission-access";
import { ShipStore } from "@/lib/ship-store";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = missionAccess(request);
    const { id } = await context.params;
    const store = new ShipStore();
    try {
      const investigation = store.get(access.owner, id);
      if (!investigation)
        return missionResponse({ error: "Investigation not found." }, access.cookie, 404);
      return missionResponse({ investigation }, access.cookie);
    } finally {
      store.close();
    }
  } catch (error) {
    return missionResponse(
      { error: error instanceof Error ? error.message : "Investigation unavailable." },
      undefined,
      400,
    );
  }
}
