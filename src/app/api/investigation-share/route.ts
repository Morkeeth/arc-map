import {
  missionAccess,
  missionResponse,
  readMissionBody,
} from "@/lib/mission-access";
import { MissionStore } from "@/lib/mission-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let access;
  try {
    access = missionAccess(request, true);
  } catch {
    return missionResponse({ error: "Access denied." }, undefined, 403);
  }
  const store = new MissionStore();
  try {
    const body = await readMissionBody(request);
    if (body.action === "create") {
      if (typeof body.missionId !== "string")
        throw new Error("Mission id is required.");
      return missionResponse(
        { invite: store.createInvite(access.owner, body.missionId) },
        access.cookie,
        201,
      );
    }
    if (body.action === "accept")
      return missionResponse(
        { mission: store.acceptInvite(access.owner, body.token) },
        access.cookie,
      );
    if (body.action === "revoke") {
      if (typeof body.missionId !== "string")
        throw new Error("Mission id is required.");
      return missionResponse(
        { mission: store.revokeInvite(access.owner, body.missionId) },
        access.cookie,
      );
    }
    if (body.action === "counterevidence") {
      if (typeof body.missionId !== "string")
        throw new Error("Mission id is required.");
      return missionResponse(
        {
          mission: store.addCounterevidence(
            access.owner,
            body.missionId,
            body,
          ),
        },
        access.cookie,
        201,
      );
    }
    throw new Error("Choose create, accept, revoke or counterevidence.");
  } catch (error) {
    return missionResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Investigation sharing failed.",
      },
      access.cookie,
      400,
    );
  } finally {
    store.close();
  }
}
