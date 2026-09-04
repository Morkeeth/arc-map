import { hunters } from "@/lib/hunters";
import { chainConfig } from "@/lib/mission-chain";
import { PRIVY_APP_ID } from "@/lib/app-config";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(
    {
      hunters,
      capabilities: {
        graphConfigured: Boolean(process.env.GRAPH_TRANSFERS_URL),
        walletConfigured: Boolean(PRIVY_APP_ID),
        escrow: chainConfig(),
        automaticTrading: false,
        investmentShares: false,
        mode: "testnet-research",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
