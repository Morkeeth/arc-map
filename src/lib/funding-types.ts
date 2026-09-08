import type { Address, Hex } from "viem";

export type MissionFundingPolicy = {
  version: 1;
  action: "fund";
  chainId: number;
  account: Address;
  target: Address;
  asset: "native:testnet-usdc";
  amount: string;
  amountCeiling: string;
  missionId: Hex;
  thesisHash: Hex;
  reportHash: Hex;
  evidence: {
    provider: "graph";
    source: string;
    sourceBlock: number;
    observedAt: string;
  };
  executor: Address;
  service: Address;
  fee: string;
  missionDeadline: number;
  preparedAt: string;
  expiresAt: string;
  calldata: Hex;
  bindingHash: Hex;
};

export type PreparedMissionTransaction = {
  to: Address;
  data: Hex;
  value: string;
  chainId: number;
  account: Address;
  action: "fund" | "close";
  simulatedAt: string;
  expiresAt: string;
  policy: MissionFundingPolicy | null;
};

export type MissionFundingReceipt = {
  version: 1;
  status: "active";
  transactionHash: Hex;
  verifiedAt: string;
  confirmations: number;
  chainId: number;
  blockNumber: string;
  blockHash: Hex;
  blockTimestamp: number;
  account: Address;
  target: Address;
  asset: "native:testnet-usdc";
  amount: string;
  amountCeiling: string;
  missionId: Hex;
  thesisHash: Hex;
  reportHash: Hex;
  policyExpiresAt: string;
  bindingHash: Hex;
};

export type FundingReceiptObservation = {
  chainId: number;
  receiptStatus: "success" | "reverted";
  transactionHash: Hex;
  transaction: {
    from: Address;
    to: Address | null;
    input: Hex;
    value: bigint;
  };
  blockNumber: bigint;
  blockHash: Hex;
  blockTimestamp: number;
  currentBlockNumber: bigint;
  opened: {
    missionId: Hex;
    owner: Address;
    thesisHash: Hex;
    budget: bigint;
    fee: bigint;
    executor: Address;
    service: Address;
    deadline: bigint;
  } | null;
};
