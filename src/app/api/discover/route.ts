import { getSnapshot } from "@/lib/providers/explorer";
import { getGraphSnapshot } from "@/lib/providers/graph";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = process.env.GRAPH_SUBGRAPH_URL ? await getGraphSnapshot() : await getSnapshot();
    return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The discovery source is unavailable. Try refreshing in a moment." }, { status: 502 });
  }
}

