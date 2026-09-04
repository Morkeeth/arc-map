import { ADDRESS, asCount } from "../analysis";
import type { Transfer } from "../types";

const HASH = /^0x[0-9a-fA-F]{64}$/;
export const TRANSFER_QUERY = `query HunterTransfers($token: Bytes!, $limit: Int!) {
  transfers(first: $limit, orderBy: blockTimestamp, orderDirection: desc, where: {token: $token}) {
    token from to transactionHash logIndex blockNumber blockTimestamp
  }
  _meta { block { number } hasIndexingErrors }
}`;
export function parseGraphTransfers(payload: unknown, token: string) {
  const p = payload as {
    errors?: unknown;
    data?: {
      _meta?: { block?: { number?: unknown }; hasIndexingErrors?: boolean };
      transfers?: Record<string, unknown>[];
    };
  };
  const block = asCount(p?.data?._meta?.block?.number);
  if (
    p?.errors ||
    p?.data?._meta?.hasIndexingErrors !== false ||
    block === null ||
    !Array.isArray(p?.data?.transfers)
  )
    throw new Error("Graph indexing status or response is invalid.");
  if (p.data.transfers.length > 201)
    throw new Error("Graph sample exceeds the requested bound.");
  const seen = new Set<string>();
  const rows: Transfer[] = [];
  for (const r of p.data.transfers) {
    const n = asCount(r.blockNumber),
      log = asCount(r.logIndex),
      seconds = asCount(r.blockTimestamp);
    if (
      typeof r.token !== "string" ||
      r.token.toLowerCase() !== token.toLowerCase() ||
      typeof r.from !== "string" ||
      !ADDRESS.test(r.from) ||
      typeof r.to !== "string" ||
      !ADDRESS.test(r.to) ||
      typeof r.transactionHash !== "string" ||
      !HASH.test(r.transactionHash) ||
      n === null ||
      n > block ||
      log === null ||
      seconds === null ||
      seconds > Math.floor(Date.now() / 1000) + 60
    )
      throw new Error(
        "Graph returned an invalid or unrelated transfer. No finding was produced.",
      );
    const key = `${r.transactionHash.toLowerCase()}:${log}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      from: r.from,
      to: r.to,
      transaction: r.transactionHash,
      logIndex: log,
      block: n,
      timestamp: new Date(seconds * 1000).toISOString(),
    });
  }
  return {
    indexedBlock: block,
    transfers: rows.slice(0, 200),
    moreAvailable: p.data.transfers.length > 200,
  };
}
export async function queryGraphTransfers(token: string) {
  if (!ADDRESS.test(token)) throw new Error("Invalid token address.");
  const endpoint = process.env.GRAPH_TRANSFERS_URL;
  if (!endpoint)
    throw new Error(
      "Graph transfer endpoint is not configured. Deploy arcmap in Studio and set GRAPH_TRANSFERS_URL.",
    );
  const url = new URL(endpoint);
  if (url.protocol !== "https:")
    throw new Error("Graph requires an HTTPS endpoint.");
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        ...(process.env.GRAPH_API_KEY
          ? { Authorization: `Bearer ${process.env.GRAPH_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        query: TRANSFER_QUERY,
        variables: { token: token.toLowerCase(), limit: 201 },
      }),
    });
  } catch {
    throw new Error(
      "Graph transfer query failed. Explorer was not substituted.",
    );
  }
  if (!response.ok)
    throw new Error(
      "Graph transfer query was rejected. Check endpoint access.",
    );
  return parseGraphTransfers(await response.json(), token);
}
