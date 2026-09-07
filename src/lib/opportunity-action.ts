import {
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddress,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem";

export const LOCAL_OPPORTUNITY_CHAIN_ID = 31_337;

export type OpportunityEvidence = {
  reportId: string;
  source: string;
  observedAt: string;
  counterevidence: string;
};

export type OpportunityPolicy = {
  chainId: typeof LOCAL_OPPORTUNITY_CHAIN_ID;
  account: Address;
  asset: Address;
  reportContract: Address;
  amountCeiling: bigint;
  expiresAt: number;
};

export type OpportunityActionRequest = {
  account: Address;
  asset: Address;
  target: Address;
  amount: bigint;
  evidence: OpportunityEvidence;
  policy: OpportunityPolicy;
};

export type PreparedOpportunityAction = OpportunityActionRequest & {
  kind: "erc20-transfer-to-report-contract";
  calldata: Hex;
  bindingHash: Hex;
};

export type AssetDelta = {
  account: Address;
  before: bigint;
  after: bigint;
  delta: bigint;
};

export type OpportunitySimulationReceipt = {
  mode: "local-evm-simulation";
  action: PreparedOpportunityAction["kind"];
  account: Address;
  asset: Address;
  approvedTarget: Address;
  amount: bigint;
  amountCeiling: bigint;
  evidence: OpportunityEvidence;
  calldata: Hex;
  bindingHash: Hex;
  pin: {
    chainId: number;
    blockNumber: bigint;
    blockHash: Hex;
  };
  deltas: AssetDelta[];
  returnValue: Hex;
  broadcast: false;
};

type TraceAccount = {
  storage?: Record<Hex, Hex>;
};

type PrestateDiffTrace = {
  pre?: Record<string, TraceAccount>;
  post?: Record<string, TraceAccount>;
};

export type OpportunitySimulationClient = {
  getChainId(): Promise<number>;
  getBlock(args: { blockNumber?: bigint }): Promise<{
    number: bigint;
    hash: Hex | null;
    timestamp: bigint;
  }>;
  call(args: {
    account: Address;
    to: Address;
    data: Hex;
    blockNumber: bigint;
  }): Promise<{ data?: Hex }>;
  request(args: {
    method: "debug_traceCall";
    params: [
      { from: Address; to: Address; data: Hex },
      Hex,
      { tracer: "prestateTracer"; tracerConfig: { diffMode: true } },
    ];
  }): Promise<unknown>;
};

export function prepareOpportunityAction(
  request: OpportunityActionRequest,
  now: number,
): PreparedOpportunityAction {
  assertAddress(request.account, "Selected account");
  assertAddress(request.asset, "Asset");
  assertAddress(request.target, "Target");
  assertAddress(request.policy.account, "Policy account");
  assertAddress(request.policy.asset, "Policy asset");
  assertAddress(request.policy.reportContract, "Report contract");

  if (request.policy.chainId !== LOCAL_OPPORTUNITY_CHAIN_ID)
    throw new Error("Opportunity policy is not pinned to the local fixture chain.");
  if (!sameAddress(request.account, request.policy.account))
    throw new Error("Selected account does not match the policy account binding.");
  if (!sameAddress(request.asset, request.policy.asset))
    throw new Error("Selected asset does not match the policy asset binding.");
  if (!sameAddress(request.target, request.policy.reportContract))
    throw new Error("Target is not the report contract approved by policy.");
  if (request.amount <= 0n || request.amount > request.policy.amountCeiling)
    throw new Error("Transfer amount is outside the policy ceiling.");
  if (!Number.isSafeInteger(request.policy.expiresAt) || now > request.policy.expiresAt)
    throw new Error("Opportunity policy is expired or invalid.");
  if (
    !request.evidence.reportId.trim() ||
    !request.evidence.source.trim() ||
    !Number.isFinite(Date.parse(request.evidence.observedAt))
  )
    throw new Error("A valid evidence reference is required.");
  if (!request.evidence.counterevidence.trim())
    throw new Error("Counterevidence is required before opportunity simulation.");

  const calldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [getAddress(request.target), request.amount],
  });
  const bindingHash = keccak256(
    toHex(
      JSON.stringify({
        kind: "erc20-transfer-to-report-contract",
        account: request.account.toLowerCase(),
        asset: request.asset.toLowerCase(),
        target: request.target.toLowerCase(),
        amount: request.amount.toString(),
        evidence: request.evidence,
        policy: {
          ...request.policy,
          account: request.policy.account.toLowerCase(),
          asset: request.policy.asset.toLowerCase(),
          reportContract: request.policy.reportContract.toLowerCase(),
          amountCeiling: request.policy.amountCeiling.toString(),
        },
        calldata,
      }),
    ),
  );
  return {
    ...request,
    kind: "erc20-transfer-to-report-contract",
    calldata,
    bindingHash,
  };
}

export async function simulateOpportunityAction(
  client: OpportunitySimulationClient,
  prepared: PreparedOpportunityAction,
): Promise<OpportunitySimulationReceipt> {
  const decoded = decodeFunctionData({ abi: erc20Abi, data: prepared.calldata });
  if (
    decoded.functionName !== "transfer" ||
    decoded.args[1] !== prepared.amount ||
    !sameAddress(decoded.args[0], prepared.policy.reportContract)
  )
    throw new Error("Calldata does not match the bound allowlisted transfer.");

  const chainId = await client.getChainId();
  if (chainId !== prepared.policy.chainId)
    throw new Error("Simulation chain does not match the policy chain.");
  const block = await client.getBlock({});
  if (!block.hash) throw new Error("Pinned simulation block has no hash.");
  if (block.timestamp > BigInt(prepared.policy.expiresAt))
    throw new Error("Opportunity policy expired at the pinned block.");

  const call = {
    account: prepared.account,
    to: prepared.asset,
    data: prepared.calldata,
    blockNumber: block.number,
  };
  const result = await client.call(call);
  const trace = (await client.request({
    method: "debug_traceCall",
    params: [
      {
        from: prepared.account,
        to: prepared.asset,
        data: prepared.calldata,
      },
      toHex(block.number),
      { tracer: "prestateTracer", tracerConfig: { diffMode: true } },
    ],
  })) as PrestateDiffTrace;

  return {
    mode: "local-evm-simulation",
    action: prepared.kind,
    account: prepared.account,
    asset: prepared.asset,
    approvedTarget: prepared.policy.reportContract,
    amount: prepared.amount,
    amountCeiling: prepared.policy.amountCeiling,
    evidence: prepared.evidence,
    calldata: prepared.calldata,
    bindingHash: prepared.bindingHash,
    pin: {
      chainId,
      blockNumber: block.number,
      blockHash: block.hash,
    },
    deltas: [
      decodeBalanceDelta(trace, prepared.asset, prepared.account),
      decodeBalanceDelta(
        trace,
        prepared.asset,
        prepared.policy.reportContract,
      ),
    ],
    returnValue: result.data ?? "0x",
    broadcast: false,
  };
}

export function erc20BalanceSlot(account: Address): Hex {
  return keccak256(
    `0x${account.slice(2).padStart(64, "0")}${"0".repeat(64)}` as Hex,
  );
}

function decodeBalanceDelta(
  trace: PrestateDiffTrace,
  asset: Address,
  account: Address,
): AssetDelta {
  const contract = asset.toLowerCase();
  const slot = erc20BalanceSlot(account).toLowerCase() as Hex;
  const before = storageValue(trace.pre?.[contract], slot);
  const after = storageValue(trace.post?.[contract], slot);
  return { account, before, after, delta: after - before };
}

function storageValue(account: TraceAccount | undefined, slot: Hex): bigint {
  const storage = account?.storage;
  if (!storage) return 0n;
  const value = Object.entries(storage).find(
    ([key]) => key.toLowerCase() === slot,
  )?.[1];
  return value ? BigInt(value) : 0n;
}

function assertAddress(value: string, label: string) {
  if (!isAddress(value, { strict: true }))
    throw new Error(`${label} is not a valid address.`);
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}
