import { createPublicClient, http } from "viem";
import { arcTestnet } from "viem/chains";
import { queryGraphTransfers } from "../src/lib/providers/graph-transfers";
import { chainConfig, checkedChain } from "../src/lib/mission-chain";
import { projects } from "../src/lib/projects";
async function main() {
  const checks: Record<string, unknown> = {};
  const rpc = createPublicClient({
    chain: arcTestnet,
    transport: http(
      process.env.ARC_RPC_URL || arcTestnet.rpcUrls.default.http[0],
      { timeout: 10000, retryCount: 0 },
    ),
  });
  try {
    const [chainId, block] = await Promise.all([
      rpc.getChainId(),
      rpc.getBlock(),
    ]);
    checks.rpc = {
      reachable: chainId === 5042002,
      chainId,
      block: block.number.toString(),
      blockTimestamp: Number(block.timestamp),
    };
  } catch {
    checks.rpc = { reachable: false };
  }
  if (process.env.GRAPH_TRANSFERS_URL)
    try {
      const graph = await queryGraphTransfers(projects[0].contract!);
      checks.graph = {
        configured: true,
        verified: true,
        indexedBlock: graph.indexedBlock,
        sampledEvents: graph.transfers.length,
      };
    } catch {
      checks.graph = { configured: true, verified: false };
    }
  else
    checks.graph = {
      configured: false,
      verified: false,
      needed: "Deploy the transfer subgraph and configure its query URL.",
    };
  const escrow = chainConfig();
  checks.escrow = { configured: escrow.configured, verified: false };
  if (escrow.configured)
    try {
      await checkedChain();
      checks.escrow = { configured: true, verified: true, chainId: 5042002 };
    } catch {}
  checks.executor = {
    configured: Boolean(process.env.HUNTER_EXECUTOR_PRIVATE_KEY),
    automaticallyStarted: false,
  };
  checks.mainnet = {
    enabled: false,
    reason:
      "Escrow is restricted to test networks; investment shares are not implemented.",
  };
  console.log(JSON.stringify(checks, null, 2));
}
main().catch(() => {
  console.error("Integration check failed. Credentials were not logged.");
  process.exitCode = 1;
});
