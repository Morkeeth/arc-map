import { scoutToken } from "@/lib/providers/explorer";
import { ADDRESS } from "@/lib/analysis";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address || !ADDRESS.test(address)) return Response.json({ error: "A valid token address is required." }, { status: 400 });
  try {
    return Response.json(await scoutToken(address), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The scout could not reach the explorer. No findings were produced. Try again." }, { status: 502 });
  }
}

