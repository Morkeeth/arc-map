import {
  createPublicClient,
  http,
  isAddress,
  keccak256,
  parseEther,
  encodeFunctionData,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { arcTestnet } from "viem/chains";
import { escrowAbi } from "./escrow";
import type { Mission } from "./hunters";
import { assessIndexFreshness } from "./index-freshness";

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
) {
  if (typeof account !== "string" || !isAddress(account))
    throw new Error("Connect a wallet first.");
  const { client, config } = await checkedChain();
  const state = await missionChainState(mission);
  if (Math.abs(Math.floor(Date.now() / 1000) - state.blockTimestamp) > 120)
    throw new Error("RPC block is stale. Action blocked.");
  let data: Hex,
    value = 0n;
  if (action === "fund") {
    if (mission.provider !== "graph" || !mission.report || !mission.reportHash)
      throw new Error(
        "Complete a Graph-backed research preview before funding. Explorer previews are not billable.",
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
    data = encodeFunctionData({
      abi: escrowAbi,
      functionName: "openMission",
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
    value = parseEther(mission.budget);
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
  } else if (action === "close") {
    if (
      !state.funded ||
      state.closed ||
      state.owner.toLowerCase() !== account.toLowerCase()
    )
      throw new Error(
        "Only the mission owner can reclaim its remaining budget.",
      );
    data = encodeFunctionData({
      abi: escrowAbi,
      functionName: "closeMission",
      args: [mission.id as Hex],
    });
    await client.simulateContract({
      address: config.address!,
      abi: escrowAbi,
      functionName: "closeMission",
      account,
      args: [mission.id as Hex],
    });
  } else throw new Error("Unsupported wallet action.");
  return {
    to: config.address!,
    data,
    value: value.toString(),
    chainId: config.chainId,
    account,
    action,
    simulatedAt: new Date().toISOString(),
    expiresAt: Date.now() + 60_000,
  };
}
