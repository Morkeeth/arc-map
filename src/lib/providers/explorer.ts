import type { Snapshot, Token, Transfer } from "../types";
import { ADDRESS, asCount, districtFor, summarizeTransfers } from "../analysis";

const ORIGIN = "https://testnet.arcscan.app";

async function getJson(path: string) {
  const response = await fetch(`${ORIGIN}${path}`, {
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Explorer unavailable (${response.status}). Please try again.`);
  return response.json();
}

export async function getSnapshot(): Promise<Snapshot> {
  const data = await getJson("/api/v2/tokens?type=ERC-20");
  if (!Array.isArray(data.items)) throw new Error("The explorer returned an unexpected token response.");
  const tokens: Token[] = data.items.flatMap((item: Record<string, unknown>) => {
    if (typeof item.address_hash !== "string" || !ADDRESS.test(item.address_hash)) return [];
    const name = typeof item.name === "string" ? item.name.slice(0, 100) : "Unnamed token";
    const symbol = typeof item.symbol === "string" ? item.symbol.slice(0, 30) : "TOKEN";
    return [{ address: item.address_hash, name, symbol, holders: asCount(item.holders_count), district: districtFor(name, symbol) }];
  });
  return {
    tokens,
    fetchedAt: new Date().toISOString(),
    source: "Arcscan explorer",
    sourceUrl: `${ORIGIN}/api/v2/tokens?type=ERC-20`,
    coverage: `First ${tokens.length} ERC-20 listings returned by the explorer, ordered by holders. This is not a complete project or activity index.`,
  };
}

export async function scoutToken(address: string) {
  if (!ADDRESS.test(address)) throw new Error("Invalid token address.");
  const [counters, first] = await Promise.all([
    getJson(`/api/v2/tokens/${address}/counters`),
    getJson(`/api/v2/tokens/${address}/transfers`),
  ]);
  if (!Array.isArray(first.items)) throw new Error("The explorer returned an unexpected transfer response.");
  const transfers: Transfer[] = [];
  for (const item of first.items.slice(0, 100)) {
    if (!ADDRESS.test(item.from?.hash) || !ADDRESS.test(item.to?.hash)) continue;
    if (typeof item.transaction_hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(item.transaction_hash)) continue;
    if (!Number.isSafeInteger(item.log_index) || !Number.isSafeInteger(item.block_number)) continue;
    transfers.push({
      from: item.from.hash,
      to: item.to.hash,
      transaction: item.transaction_hash,
      logIndex: item.log_index,
      block: item.block_number,
      timestamp: typeof item.timestamp === "string" && Number.isFinite(Date.parse(item.timestamp)) ? item.timestamp : null,
    });
  }
  return summarizeTransfers({ address, transfers, holderCount: counters.token_holders_count, transferCount: counters.transfers_count, moreAvailable: Boolean(first.next_page_params), fetchedAt: new Date().toISOString() });
}

