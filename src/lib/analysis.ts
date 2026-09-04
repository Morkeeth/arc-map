import type { District, HuntReport, Transfer } from "./types";

export const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function asCount(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

// Navigation categories, inferred from token metadata; never protocol verification.
export function districtFor(name: string, symbol: string): District {
  const text = `${name} ${symbol}`;
  if (/vault|staked|\bxyUSDC\b/i.test(text)) return "Vaults";
  if (/\bLP\b|pool|gauge|USDC.EURC/i.test(text)) return "Pools";
  if (/^(USDC|EURC|USDT|WUSDC|cirBTC|USYC)$/i.test(symbol) || /wrapped/i.test(name)) return "Assets";
  return "Tokens";
}

export function summarizeTransfers(input: {
  address: string;
  transfers: Transfer[];
  holderCount: unknown;
  transferCount: unknown;
  moreAvailable: boolean;
  fetchedAt: string;
}): HuntReport {
  const seen = new Set<string>();
  const transfers = input.transfers.filter((transfer) => {
    const key = `${transfer.transaction.toLowerCase()}:${transfer.logIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const senders = new Map<string, number>();
  const recipients = new Set<string>();
  const transactions = new Set<string>();
  for (const transfer of transfers) {
    const from = transfer.from.toLowerCase();
    senders.set(from, (senders.get(from) ?? 0) + 1);
    recipients.add(transfer.to.toLowerCase());
    transactions.add(transfer.transaction.toLowerCase());
  }
  const leader = [...senders.entries()].sort((a, b) => b[1] - a[1])[0];
  const holders = asCount(input.holderCount);
  const count = asCount(input.transferCount);
  const dates = transfers.map((t) => t.timestamp).filter((t): t is string => Boolean(t)).sort();
  const observations = [
    `Examined ${transfers.length.toLocaleString("en-US")} transfer events across ${transactions.size.toLocaleString("en-US")} transactions in the returned sample.`,
  ];
  if (holders !== null && count !== null && holders === count) {
    observations.push(`The explorer reports equal totals: ${holders.toLocaleString("en-US")} holders and ${count.toLocaleString("en-US")} transfer events. Equality alone does not establish how the token was used.`);
  }
  if (leader) {
    observations.push(leader[0] === ZERO_ADDRESS
      ? `${leader[1]} sampled events originate at the zero address and are consistent with mint events.`
      : `${leader[1]} of ${transfers.length} sampled events share one sender address. That does not establish common ownership of recipients.`);
  }
  if (!transfers.length) observations.push("No transfer events were returned by this source. This is not proof of no historical activity.");
  return {
    address: input.address,
    fetchedAt: input.fetchedAt,
    source: `https://testnet.arcscan.app/api/v2/tokens/${input.address}/transfers`,
    holders,
    transfers: count,
    examined: transfers.length,
    uniqueSenders: senders.size,
    uniqueRecipients: recipients.size,
    uniqueTransactions: transactions.size,
    leadingSender: leader?.[0] ?? null,
    leadingSenderCount: leader?.[1] ?? 0,
    moreAvailable: input.moreAvailable,
    newestTransferAt: dates.at(-1) ?? null,
    oldestTransferAt: dates[0] ?? null,
    observations,
    limitation: "This scout examines a bounded explorer sample, not a complete transfer history. It cannot establish sybil ownership, trading intent, airdrop eligibility, or whether unsampled wallets later became active.",
    evidence: transfers.slice(0, 8),
  };
}

