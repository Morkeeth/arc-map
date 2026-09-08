import {
  createPublicClient,
  http,
  isAddress,
  keccak256,
  parseEther,
  parseEventLogs,
  toHex,
  encodeFunctionData,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { arcTestnet } from "viem/chains";
import { escrowAbi } from "./escrow";
import { assessEvidenceCoverage } from "./evidence-coverage";
import type { Mission } from "./hunters";
import { assessIndexFreshness } from "./index-freshness";
import type {
  FundingReceiptObservation,
  MissionFundingPolicy,
  MissionFundingReceipt,
  PreparedMissionTransaction,
} from "./funding-types";

type MissionAuthorities = {
  executor: Address;
  service: Address;
};

export function encodeUnsignedMissionAction(
  mission: Mission,
  action: unknown,
  authorities: MissionAuthorities,
) {
  if (action === "fund") {
    if (!mission.reportHash)
      throw new Error("A committed report is required before funding.");
    const value = parseEther(mission.budget);
    return {
      action,
      data: encodeFunctionData({
        abi: escrowAbi,
        functionName: "openMission",
        args: [
          mission.id as Hex,
          mission.thesisHash,
          mission.reportHash,
          authorities.executor,
          authorities.service,
          parseEther(mission.fee),
          BigInt(mission.deadline),
        ],
      }),
      value,
    };
  }
  if (action === "close")
    return {
      action,
      data: encodeFunctionData({
        abi: escrowAbi,
        functionName: "closeMission",
        args: [mission.id as Hex],
      }),
      value: 0n,
    };
  throw new Error("Unsupported wallet action.");
}

export function chainConfig() {
  const address = process.env.HUNTER_ESCROW_ADDRESS,
    executor = process.env.HUNTER_EXECUTOR_ADDRESS,
    service = process.env.HUNTER_SERVICE_ADDRESS;
  const codeHash = process.env.HUNTER_ESCROW_CODE_HASH;
  const configured = Boolean(
    address &&
    isAddress(address) &&
    address !== zeroAddress &&
    executor &&
    isAddress(executor) &&
    executor !== zeroAddress &&
    service &&
    isAddress(service) &&
    service !== zeroAddress &&
    codeHash &&
    /^0x[0-9a-fA-F]{64}$/.test(codeHash),
  );
  return {
    configured,
    address: configured ? (address as Address) : null,
    executor: configured ? (executor as Address) : null,
    service: configured ? (service as Address) : null,
    codeHash: configured ? (codeHash as Hex) : null,
    chainId: arcTestnet.id,
    currency: "testnet USDC",
    fee: "0.01",
    reason: configured
      ? null
      : "Testnet escrow deployment, runtime code hash, executor and payee must be configured before funding.",
  };
}
export async function checkedChain() {
  const config = chainConfig();
  if (!config.configured || !config.address) throw new Error(config.reason!);
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(
      process.env.ARC_RPC_URL || arcTestnet.rpcUrls.default.http[0],
      { timeout: 12000, retryCount: 0 },
    ),
  });
  if ((await client.getChainId()) !== arcTestnet.id)
    throw new Error("RPC is not Arc testnet. Action blocked.");
  const bytecode = await client.getCode({ address: config.address });
  if (!bytecode || keccak256(bytecode) !== config.codeHash)
    throw new Error(
      "Escrow runtime code does not match the configured deployment. Action blocked.",
    );
  return { client, config };
}
export async function missionChainState(mission: Mission) {
  const { client, config } = await checkedChain();
  const block = await client.getBlock();
  const row = await client.readContract({
    address: config.address!,
    abi: escrowAbi,
    functionName: "missions",
    args: [mission.id as Hex],
    blockNumber: block.number,
  });
  const [
    owner,
    executor,
    service,
    remaining,
    fee,
    deadline,
    completed,
    closed,
    thesisHash,
    reportHash,
    expectedReportHash,
  ] = row;
  if (
    owner !== zeroAddress &&
    (thesisHash !== mission.thesisHash ||
      expectedReportHash !== mission.reportHash ||
      fee !== parseEther(mission.fee) ||
      deadline !== BigInt(mission.deadline) ||
      executor.toLowerCase() !== config.executor!.toLowerCase() ||
      service.toLowerCase() !== config.service!.toLowerCase())
  )
    throw new Error(
      "Onchain mission does not match the approved research mandate.",
    );
  return {
    funded: owner !== zeroAddress,
    owner,
    executor,
    service,
    remaining: remaining.toString(),
    fee: fee.toString(),
    deadline: Number(deadline),
    completed,
    closed,
    thesisHash,
    reportHash,
    expectedReportHash,
    reportMatches: Boolean(
      mission.reportHash && reportHash === mission.reportHash,
    ),
    block: block.number.toString(),
    blockTimestamp: Number(block.timestamp),
    escrow: config.address,
    chainId: config.chainId,
  };
}
export async function prepareMissionAction(
  mission: Mission,
  action: unknown,
  account: unknown,
): Promise<PreparedMissionTransaction> {
  if (typeof account !== "string" || !isAddress(account))
    throw new Error("Connect a wallet first.");
  if (action === "fund") {
    const coverage = assessEvidenceCoverage(mission);
    if (coverage.funding === "withheld") throw new Error(coverage.reason);
  }
  const { client, config } = await checkedChain();
  const state = await missionChainState(mission);
  if (Math.abs(Math.floor(Date.now() / 1000) - state.blockTimestamp) > 120)
    throw new Error("RPC block is stale. Action blocked.");
  let data: Hex,
    value = 0n,
    policy: MissionFundingPolicy | null = null;
  if (action === "fund") {
    if (mission.provider !== "graph" || !mission.report || !mission.reportHash)
      throw new Error(
        "Complete a Graph-backed research preview before funding. Explorer previews are not billable.",
      );
    if (mission.report.stance !== "limited-support")
      throw new Error(
        "The Hunter evidence does not support funding. Create a new mission with stronger evidence.",
      );
    if (Date.now() - Date.parse(mission.report.observedAt) > 15 * 60_000)
      throw new Error(
        "Research preview is stale. Create a fresh mission before funding.",
      );
    if (mission.report.indexedBlock === null)
      throw new Error("Graph indexed block is missing.");
    const indexedBlock = await client.getBlock({
      blockNumber: BigInt(mission.report.indexedBlock),
    });
    const freshness = assessIndexFreshness({ chainTimestamp: state.blockTimestamp, indexedTimestamp: Number(indexedBlock.timestamp), chainBlock: Number(state.block), indexedBlock: mission.report.indexedBlock, now: Math.floor(Date.now() / 1000) });
    if (!freshness.fresh) throw new Error(freshness.reason!);
    if (state.funded) throw new Error("Mission is already funded.");
    if (mission.deadline <= Math.floor(Date.now() / 1000))
      throw new Error("Mission expired. Create a new one.");
    const unsigned = encodeUnsignedMissionAction(mission, action, {
      executor: config.executor!,
      service: config.service!,
    });
    data = unsigned.data;
    value = unsigned.value;
    await client.simulateContract({
      address: config.address!,
      abi: escrowAbi,
      functionName: "openMission",
      account,
      value,
      args: [
        mission.id as Hex,
        mission.thesisHash,
        mission.reportHash!,
        config.executor!,
        config.service!,
        parseEther(mission.fee),
        BigInt(mission.deadline),
      ],
    });
    policy = missionFundingPolicy(
      mission,
      account as Address,
      config.address!,
      config.executor!,
      config.service!,
      data,
    );
  } else if (action === "close") {
    if (
      !state.funded ||
      state.closed ||
      state.owner.toLowerCase() !== account.toLowerCase()
    )
      throw new Error(
        "Only the mission owner can reclaim its remaining budget.",
      );
    const unsigned = encodeUnsignedMissionAction(mission, action, {
      executor: config.executor!,
      service: config.service!,
    });
    data = unsigned.data;
    value = unsigned.value;
    await client.simulateContract({
      address: config.address!,
      abi: escrowAbi,
      functionName: "closeMission",
      account,
      args: [mission.id as Hex],
    });
  } else throw new Error("Unsupported wallet action.");
  const expiresAt = policy?.expiresAt ?? new Date(Date.now() + 60_000).toISOString();
  return {
    to: config.address!,
    data,
    value: value.toString(),
    chainId: config.chainId,
    account,
    action,
    simulatedAt: new Date().toISOString(),
    expiresAt,
    policy,
  };
}

export function missionFundingPolicy(
  mission: Mission,
  account: Address,
  target: Address,
  executor: Address,
  service: Address,
  calldata: Hex,
  now = Date.now(),
): MissionFundingPolicy {
  if (
    mission.provider !== "graph" ||
    !mission.report ||
    !mission.reportHash ||
    mission.report.indexedBlock === null ||
    mission.report.stance !== "limited-support"
  )
    throw new Error("A Graph-backed report commitment is required.");
  const preparedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + 60_000).toISOString();
  const unsignedPolicy = {
    version: 1 as const,
    action: "fund" as const,
    chainId: arcTestnet.id,
    account,
    target,
    asset: "native:testnet-usdc" as const,
    amount: parseEther(mission.budget).toString(),
    amountCeiling: parseEther(mission.budget).toString(),
    missionId: mission.id as Hex,
    thesisHash: mission.thesisHash,
    reportHash: mission.reportHash,
    evidence: {
      provider: "graph" as const,
      source: mission.report.source,
      sourceBlock: mission.report.indexedBlock,
      observedAt: mission.report.observedAt,
    },
    executor,
    service,
    fee: parseEther(mission.fee).toString(),
    missionDeadline: mission.deadline,
    preparedAt,
    expiresAt,
    calldata,
  };
  return {
    ...unsignedPolicy,
    bindingHash: fundingBindingHash(unsignedPolicy),
  };
}

function fundingBindingHash(
  policy: Omit<MissionFundingPolicy, "bindingHash">,
): Hex {
  return keccak256(
    toHex(
      JSON.stringify({
        ...policy,
        account: policy.account.toLowerCase(),
        target: policy.target.toLowerCase(),
        executor: policy.executor.toLowerCase(),
        service: policy.service.toLowerCase(),
      }),
    ),
  );
}

export function verifyFundingReceiptObservation(
  mission: Mission,
  intent: PreparedMissionTransaction,
  observation: FundingReceiptObservation,
  verifiedAt = new Date().toISOString(),
): MissionFundingReceipt {
  const policy = intent.policy;
  if (intent.action !== "fund" || !policy)
    throw new Error("No policy-bound funding request exists.");
  const { bindingHash, ...unsignedPolicy } = policy;
  if (fundingBindingHash(unsignedPolicy) !== bindingHash)
    throw new Error("Prepared funding policy was changed.");
  if (
    intent.chainId !== policy.chainId ||
    intent.account.toLowerCase() !== policy.account.toLowerCase() ||
    intent.to.toLowerCase() !== policy.target.toLowerCase() ||
    intent.expiresAt !== policy.expiresAt
  )
    throw new Error("Prepared transaction no longer matches its funding policy.");
  if (
    mission.id !== policy.missionId ||
    mission.thesisHash !== policy.thesisHash ||
    mission.reportHash !== policy.reportHash
  )
    throw new Error("Mission or evidence commitment changed after preparation.");
  if (observation.chainId !== policy.chainId)
    throw new Error("Funding receipt is from the wrong chain.");
  if (observation.receiptStatus !== "success")
    throw new Error("Funding transaction failed. Mission remains inactive.");
  if (
    observation.transaction.from.toLowerCase() !== policy.account.toLowerCase() ||
    observation.opened?.owner.toLowerCase() !== policy.account.toLowerCase()
  )
    throw new Error("Funding receipt account does not match the Privy wallet.");
  if (
    !observation.transaction.to ||
    observation.transaction.to.toLowerCase() !== policy.target.toLowerCase()
  )
    throw new Error("Funding receipt target does not match the policy.");
  if (
    observation.transaction.input !== policy.calldata ||
    intent.data !== policy.calldata
  )
    throw new Error("Funding calldata changed after policy preparation.");
  if (
    observation.transaction.value.toString() !== policy.amount ||
    intent.value !== policy.amount ||
    BigInt(policy.amount) > BigInt(policy.amountCeiling)
  )
    throw new Error("Funding amount is outside the prepared ceiling.");
  if (observation.blockTimestamp > Math.floor(Date.parse(policy.expiresAt) / 1_000))
    throw new Error("Funding transaction landed after the policy expired.");
  const opened = observation.opened;
  if (
    !opened ||
    opened.missionId !== policy.missionId ||
    opened.thesisHash !== policy.thesisHash ||
    opened.budget.toString() !== policy.amount ||
    opened.fee.toString() !== policy.fee ||
    opened.executor.toLowerCase() !== policy.executor.toLowerCase() ||
    opened.service.toLowerCase() !== policy.service.toLowerCase() ||
    opened.deadline !== BigInt(policy.missionDeadline)
  )
    throw new Error("MissionOpened event does not match the prepared policy.");
  const confirmations = Number(
    observation.currentBlockNumber - observation.blockNumber + 1n,
  );
  if (!Number.isSafeInteger(confirmations) || confirmations < 1)
    throw new Error("Funding receipt has no confirmed block.");
  return {
    version: 1,
    status: "active",
    transactionHash: observation.transactionHash,
    verifiedAt,
    confirmations,
    chainId: observation.chainId,
    blockNumber: observation.blockNumber.toString(),
    blockHash: observation.blockHash,
    blockTimestamp: observation.blockTimestamp,
    account: policy.account,
    target: policy.target,
    asset: policy.asset,
    amount: policy.amount,
    amountCeiling: policy.amountCeiling,
    missionId: policy.missionId,
    thesisHash: policy.thesisHash,
    reportHash: policy.reportHash,
    policyExpiresAt: policy.expiresAt,
    bindingHash,
  };
}

export async function verifyMissionFundingReceipt(
  mission: Mission,
  intent: PreparedMissionTransaction,
  transactionHash: Hex,
): Promise<MissionFundingReceipt> {
  const { client, config } = await checkedChain();
  const receipt = await client.getTransactionReceipt({ hash: transactionHash });
  const transaction = await client.getTransaction({ hash: transactionHash });
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  const currentBlockNumber = await client.getBlockNumber();
  const openedLog = parseEventLogs({
    abi: escrowAbi,
    logs: receipt.logs,
    eventName: "MissionOpened",
  }).find((entry) => entry.args.id === mission.id);
  const opened = openedLog
    ? {
        missionId: openedLog.args.id,
        owner: openedLog.args.owner,
        thesisHash: openedLog.args.thesisHash,
        budget: openedLog.args.budget,
        fee: openedLog.args.fee,
        executor: openedLog.args.executor,
        service: openedLog.args.service,
        deadline: openedLog.args.deadline,
      }
    : null;
  const verified = verifyFundingReceiptObservation(mission, intent, {
    chainId: config.chainId,
    receiptStatus: receipt.status,
    transactionHash,
    transaction: {
      from: transaction.from,
      to: transaction.to,
      input: transaction.input,
      value: transaction.value,
    },
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    blockTimestamp: Number(block.timestamp),
    currentBlockNumber,
    opened,
  });
  const state = await missionChainState(mission);
  if (
    !state.funded ||
    state.closed ||
    state.owner.toLowerCase() !== verified.account.toLowerCase() ||
    state.remaining !== verified.amount ||
    state.expectedReportHash !== verified.reportHash
  )
    throw new Error("Verified receipt does not match current escrow state.");
  return verified;
}
