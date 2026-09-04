import { inspectRepository } from "@/lib/providers/repository";
import { missionAccess, missionResponse } from "@/lib/mission-access";
export const dynamic = "force-dynamic";
// Read-only, short process cache avoids a fresh GitHub call on each UI refresh.
const cache = new Map<string, { at: number; report: ReturnType<typeof inspectRepository> }>();
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = missionAccess(request);
    const { id } = await context.params;
    let value = cache.get(id);
    if (!value || Date.now() - value.at > 60000) {
      value = { at: Date.now(), report: inspectRepository(id) };
      // Only two curated repository IDs can produce successful evidence.
      if (["arc-node", "circle-agent-stack"].includes(id)) cache.set(id, value);
    }
    return missionResponse({ report: await value.report }, access.cookie);
  } catch { return missionResponse({ error: "Repository evidence unavailable. No deployment claim can be made." }, undefined, 502); }
}
