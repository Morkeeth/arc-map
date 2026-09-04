import { RadarStore } from "@/lib/radar-store";
import { radarProject } from "@/lib/research-catalog";
export const dynamic = "force-dynamic";
export async function GET() {
  const store = new RadarStore();
  try {
    const records = store.list();
    return Response.json({ records, projects: records.map(radarProject), events: store.events(), sources: store.health(), generatedAt: new Date().toISOString(), coverage: "Bounded Arcscan pages: 50 ERC-20 listings ordered by holders, 50 source verifications, and 50 validated transactions per collection. Up to 1,000 observed contracts retained. This is not all chain activity; first observed does not mean newly launched." }, { headers: { "Cache-Control": "no-store" } });
  } finally { store.close(); }
}
