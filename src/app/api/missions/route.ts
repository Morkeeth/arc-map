import { MissionStore } from "@/lib/mission-store";
import {
  missionAccess,
  missionResponse,
  readMissionBody,
} from "@/lib/mission-access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const access = missionAccess(request);
    const store = new MissionStore();
    try {
      return missionResponse(
        { missions: store.list(access.owner) },
        access.cookie,
      );
    } finally {
      store.close();
    }
  } catch {
    return missionResponse({ error: "Access denied." }, undefined, 403);
  }
}
export async function POST(request: Request) {
  let access;
  try {
    access = missionAccess(request, true);
  } catch {
    return missionResponse({ error: "Access denied." }, undefined, 403);
  }
  try {
    const input = await readMissionBody(request);
    const store = new MissionStore();
    try {
      return missionResponse(
        { mission: store.create(access.owner, input) },
        access.cookie,
        201,
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
            : "Mission could not be created.",
      },
      access.cookie,
      400,
    );
  }
}
