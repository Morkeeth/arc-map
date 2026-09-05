import { missionAccess, missionResponse, readMissionBody } from "@/lib/mission-access";
import { ShipStore } from "@/lib/ship-store";
import { inspectReleases } from "@/lib/providers/releases";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const access = missionAccess(request);
    const store = new ShipStore();
    try {
      return missionResponse(
        { investigations: store.list(access.owner) },
        access.cookie,
      );
    } finally {
      store.close();
    }
  } catch (error) {
    return missionResponse(
      { error: error instanceof Error ? error.message : "Ship investigations unavailable." },
      undefined,
      400,
    );
  }
}

export async function POST(request: Request) {
  let cookie: string | undefined;
  try {
    const access = missionAccess(request, true);
    cookie = access.cookie;
    const body = await readMissionBody(request);
    const store = new ShipStore();
    try {
      const created = store.create(access.owner, {
        projectId: body.projectId,
        claim: body.claim,
      });
      const observe = body.observe !== false;
      if (!observe) return missionResponse({ investigation: created }, cookie);
      try {
        const observation = await inspectReleases(created.projectId);
        const investigation = store.pinObservation(
          access.owner,
          created.id,
          observation,
        );
        return missionResponse({ investigation }, cookie);
      } catch (error) {
        const investigation = store.block(
          access.owner,
          created.id,
          error instanceof Error ? error.message : "Release observation failed.",
        );
        return missionResponse({ investigation }, cookie, 502);
      }
    } finally {
      store.close();
    }
  } catch (error) {
    return missionResponse(
      { error: error instanceof Error ? error.message : "Could not create investigation." },
      cookie,
      400,
    );
  }
}
