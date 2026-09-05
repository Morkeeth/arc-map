import { missionAccess, missionResponse } from "@/lib/mission-access";
import { inspectReleases } from "@/lib/providers/releases";

export const dynamic = "force-dynamic";

const cache = new Map<string, { at: number; report: ReturnType<typeof inspectReleases> }>();

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = missionAccess(request);
    const { id } = await context.params;
    let value = cache.get(id);
    if (!value || Date.now() - value.at > 60000) {
      value = { at: Date.now(), report: inspectReleases(id) };
      if (["arc-node", "circle-agent-stack"].includes(id)) cache.set(id, value);
    }
    return missionResponse({ observation: await value.report }, access.cookie);
  } catch {
    return missionResponse(
      {
        error:
          "Release evidence unavailable. No shipping or deployment claim can be made.",
      },
      undefined,
      502,
    );
  }
}
