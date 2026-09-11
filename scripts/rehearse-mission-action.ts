import assert from "node:assert/strict";
import {
  decodeFunctionData,
  getAddress,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { escrowAbi } from "../src/lib/escrow";
import {
  chainConfig,
  encodeUnsignedMissionAction,
} from "../src/lib/mission-chain";
import type { Mission, MissionReport } from "../src/lib/hunters";

const digest = (label: string): Hex => keccak256(toHex(label));
const address = (label: string): Address =>
  getAddress(`0x${digest(label).slice(-40)}`);
const now = new Date();
const fee = chainConfig().fee;
const report: MissionReport = {
  version: 1,
  hunter: "distribution",
  thesis: "Local rehearsal fixture",
  conclusion: "Fixture only; no research finding.",
  stance: "limited-support",
  provider: "graph",
  source: "Local deterministic fixture",
  observedAt: now.toISOString(),
  indexedBlock: null,
  sampleSize: 0,
  transactions: 0,
  firstEventAt: null,
  lastEventAt: null,
  evidence: [],
  observations: [],
  limitations: ["This fixture is not live evidence."],
  steps: [],
};
const mission: Mission = {
  id: digest("arc-map-local-rehearsal-mission"),
  hunterId: "distribution",
  projectId: "local-rehearsal",
  address: address("arc-map-local-rehearsal-target"),
  thesis: report.thesis,
  thesisHash: digest(report.thesis),
  provider: "graph",
  createdAt: now.toISOString(),
  deadline: Math.floor(now.getTime() / 1000) + 60 * 60,
  budget: fee,
  fee,
  status: "reported",
  report,
  reportHash: digest(JSON.stringify(report)),
  error: null,
};
const authorities = {
  executor: address("arc-map-local-rehearsal-executor"),
  service: address("arc-map-local-rehearsal-service"),
};
const flag = process.argv.indexOf("--action");
const action: unknown = flag === -1 ? "fund" : process.argv[flag + 1];
const unsigned = encodeUnsignedMissionAction(mission, action, authorities);
const decoded = decodeFunctionData({ abi: escrowAbi, data: unsigned.data });

assert.equal(
  decoded.functionName,
  action === "fund" ? "openMission" : "closeMission",
);

console.log(
  JSON.stringify(
    {
      mode: "unsigned-local-rehearsal",
      fixture: true,
      action: unsigned.action,
      functionName: decoded.functionName,
      chainId: chainConfig().chainId,
      to: "unconfigured-local-fixture",
      value: unsigned.value,
      calldata: unsigned.data,
      signerUsed: false,
      rpcUsed: false,
      broadcast: false,
      limitation:
        "Encoding proof only. Production preparation separately rechecks live Graph freshness, Arc testnet state, escrow bytecode and contract simulation.",
    },
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  ),
);
