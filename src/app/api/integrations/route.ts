import { integrationHealth } from "@/lib/integration-health";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(await integrationHealth(), { headers: { "Cache-Control": "no-store" } });
}
