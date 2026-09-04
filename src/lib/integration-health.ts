import { createPublicClient, http } from "viem";
import { arcTestnet } from "viem/chains";
import { queryGraphTransfers } from "./providers/graph-transfers";
import { chainConfig, checkedChain } from "./mission-chain";
import { projects } from "./projects";
import { assessIndexFreshness } from "./index-freshness";

export async function probeIntegrations() {
  const checkedAt = new Date().toISOString();
  const rpc = createPublicClient({ chain: arcTestnet, transport: http(process.env.ARC_RPC_URL || arcTestnet.rpcUrls.default.http[0], { timeout: 10000, retryCount: 0 }) });
  const graphConfigured = Boolean(process.env.GRAPH_TRANSFERS_URL);
  const escrowConfigured = chainConfig().configured;
  const [chainResult, graphResult, escrowResult] = await Promise.allSettled([
    Promise.all([rpc.getChainId(), rpc.getBlock()]),
    graphConfigured ? queryGraphTransfers(projects[0].contract!) : Promise.resolve(null),
    escrowConfigured ? checkedChain().then(() => true) : Promise.resolve(false),
  ]);
  const chain = chainResult.status === "fulfilled" && chainResult.value[0] === 5042002 ? chainResult.value[1] : null;
  const graph = graphResult.status === "fulfilled" ? graphResult.value : null;
  let freshness = { fresh: false, reason: "Chain and Graph observations are required." as string | null };
  let indexedTimestamp: number | null = null;
  if (chain && graph) {
    try {
      const indexed = await rpc.getBlock({ blockNumber: BigInt(graph.indexedBlock) });
      indexedTimestamp = Number(indexed.timestamp);
      freshness = assessIndexFreshness({ chainTimestamp: Number(chain.timestamp), indexedTimestamp, chainBlock: Number(chain.number), indexedBlock: graph.indexedBlock, now: Math.floor(Date.now() / 1000) });
    } catch { freshness = { fresh: false, reason: "Indexed block could not be verified on Arc." }; }
  }
  const escrowVerified = escrowResult.status === "fulfilled" && escrowResult.value;
  return {
    checkedAt, network: "Arc testnet",
    rpc: { verified: Boolean(chain), block: chain ? Number(chain.number) : null, timestamp: chain ? Number(chain.timestamp) : null },
    graph: { configured: graphConfigured, queryVerified: Boolean(graph), indexedBlock: graph?.indexedBlock ?? null, indexedTimestamp, sampledEvents: graph?.transfers.length ?? null, ...freshness },
    escrow: { configured: escrowConfigured, codeVerified: escrowVerified },
    fundingPrerequisitesMet: freshness.fresh && escrowVerified,
    // Health is not transaction approval: the funding route rechecks each mission and simulates.
    walletAuthenticated: false, automaticExecutorEnabled: false, mainnetEnabled: false,
  };
}
let cache: { at: number; result: ReturnType<typeof probeIntegrations> } | undefined;
export function integrationHealth() {
  if (!cache || Date.now() - cache.at > 30000)
    cache = { at: Date.now(), result: probeIntegrations() };
  return cache.result;
}
