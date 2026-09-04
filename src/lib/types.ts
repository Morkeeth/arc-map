export type District = "Tokens" | "Pools" | "Vaults" | "Assets";
export type Token = {
  address: string;
  name: string;
  symbol: string;
  holders: number | null;
  district: District;
};
export type Snapshot = {
  tokens: Token[];
  fetchedAt: string;
  source: "Arcscan explorer" | "The Graph";
  sourceUrl: string;
  coverage: string;
};
export type Transfer = {
  from: string;
  to: string;
  transaction: string;
  logIndex: number;
  block: number;
  timestamp: string | null;
};
export type HuntReport = {
  address: string;
  fetchedAt: string;
  source: string;
  holders: number | null;
  transfers: number | null;
  examined: number;
  uniqueSenders: number;
  uniqueRecipients: number;
  uniqueTransactions: number;
  leadingSender: string | null;
  leadingSenderCount: number;
  moreAvailable: boolean;
  newestTransferAt: string | null;
  oldestTransferAt: string | null;
  observations: string[];
  limitation: string;
  evidence: Transfer[];
};

