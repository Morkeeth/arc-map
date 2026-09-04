import { ADDRESS, asCount, districtFor } from "../analysis";
import type { Snapshot, Token } from "../types";

// Contract for ARC MAP's future subgraph. This is not an existing deployed schema.
export async function getGraphSnapshot(): Promise<Snapshot> {
  const endpoint = process.env.GRAPH_SUBGRAPH_URL;
  if (!endpoint) throw new Error("Graph provider is not configured.");
  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(process.env.GRAPH_API_KEY ? { Authorization: `Bearer ${process.env.GRAPH_API_KEY}` } : {}) },
    body: JSON.stringify({ query: "{ tokens(first: 50, orderBy: holderCount, orderDirection: desc) { id name symbol holderCount } _meta { block { number } hasIndexingErrors } }" }),
  });
  if (!response.ok) throw new Error("Graph provider is unavailable.");
  const payload = await response.json();
  if (payload.errors || payload.data?._meta?.hasIndexingErrors || !Array.isArray(payload.data?.tokens)) throw new Error("Graph response or indexing status is invalid.");
  const tokens: Token[] = payload.data.tokens.flatMap((item: Record<string, unknown>) => {
    if (typeof item.id !== "string" || !ADDRESS.test(item.id) || typeof item.name !== "string" || typeof item.symbol !== "string") return [];
    return [{ address: item.id, name: item.name.slice(0, 100), symbol: item.symbol.slice(0, 30), holders: asCount(item.holderCount), district: districtFor(item.name, item.symbol) }];
  });
  return { tokens, fetchedAt: new Date().toISOString(), source: "The Graph", sourceUrl: "https://thegraph.com", coverage: `First ${tokens.length} indexed tokens. Provider block ${payload.data._meta?.block?.number ?? "unknown"}.` };
}

