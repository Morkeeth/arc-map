import "server-only";
import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createPublicClient,
  createTestClient,
  decodeFunctionResult,
  http,
  toHex,
  type Hex,
} from "viem";
import { foundry } from "viem/chains";
import solc from "solc";
import {
  erc20BalanceSlot,
  LOCAL_OPPORTUNITY_CHAIN_ID,
  OPPORTUNITY_EVIDENCE_MAX_AGE_SECONDS,
  opportunityFixtureAddress,
  simulateOpportunityAction,
  type PreparedOpportunityAction,
  type StoredOpportunityReceipt,
} from "./opportunity-action";
import { stableId } from "./stable-id";

const PORT = 18_554;
const STARTING_BALANCE = 1_000_000n;
let runtime: Hex | undefined;
let fixtureQueue = Promise.resolve();

export async function runOpportunityFixture(
  prepared: PreparedOpportunityAction,
): Promise<StoredOpportunityReceipt> {
  const previous = fixtureQueue;
  let release = () => {};
  fixtureQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await runIsolatedFixture(prepared);
  } finally {
    release();
  }
}

async function runIsolatedFixture(
  prepared: PreparedOpportunityAction,
): Promise<StoredOpportunityReceipt> {
  const rpcUrl = `http://127.0.0.1:${PORT}`;
  let anvil: ChildProcess | undefined;
  try {
    anvil = startAnvil();
    const publicClient = createPublicClient({
      chain: foundry,
      transport: http(rpcUrl, { retryCount: 0, timeout: 1_000 }),
    });
    await waitForAnvil(publicClient, anvil);
    const testClient = createTestClient({
      chain: foundry,
      mode: "anvil",
      transport: http(rpcUrl),
    });
    await testClient.setCode({
      address: prepared.asset,
      bytecode: compileFixtureRuntime(),
    });
    await testClient.setStorageAt({
      address: prepared.asset,
      index: erc20BalanceSlot(prepared.account),
      value: toHex(STARTING_BALANCE, { size: 32 }),
    });
    const receipt = await simulateOpportunityAction(
      publicClient as unknown as Parameters<
        typeof simulateOpportunityAction
      >[0],
      prepared,
    );
    const result = decodeFunctionResult({
      abi: [
        {
          type: "function",
          name: "transfer",
          stateMutability: "nonpayable",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
      ],
      functionName: "transfer",
      data: receipt.returnValue,
    });
    if (result !== true) throw new Error("Local fixture returned false.");
    const simulatedAt = new Date().toISOString();
    return {
      id: `opp-${stableId(`${receipt.bindingHash}:${receipt.pin.blockHash}`, 1)}`,
      simulatedAt,
      mode: receipt.mode,
      action: receipt.action,
      account: receipt.account,
      asset: receipt.asset,
      approvedTarget: receipt.approvedTarget,
      amount: receipt.amount.toString(),
      amountCeiling: receipt.amountCeiling.toString(),
      policyExpiresAt: prepared.policy.expiresAt,
      evidence: {
        ...receipt.evidence,
        freshnessSeconds:
          Math.floor(Date.parse(simulatedAt) / 1_000) -
          Math.floor(Date.parse(receipt.evidence.observedAt) / 1_000),
        maximumFreshnessSeconds: OPPORTUNITY_EVIDENCE_MAX_AGE_SECONDS,
      },
      calldata: receipt.calldata,
      bindingHash: receipt.bindingHash,
      pin: {
        chainId: LOCAL_OPPORTUNITY_CHAIN_ID,
        blockNumber: receipt.pin.blockNumber.toString(),
        blockHash: receipt.pin.blockHash,
      },
      deltas: receipt.deltas.map((delta) => ({
        account: delta.account,
        before: delta.before.toString(),
        after: delta.after.toString(),
        delta: delta.delta.toString(),
      })),
      returnValue: receipt.returnValue,
      broadcast: false,
      limitations: [
        "Isolated chain-ID-31337 Anvil fixture only; not an Arc public-chain, testnet or mainnet receipt.",
        "The connected Privy account address selects the simulated sender; no wallet signature or ownership proof is requested.",
        "debug_traceCall effects are decoded from a read-only simulation and are not persisted.",
      ],
    };
  } finally {
    anvil?.kill("SIGTERM");
  }
}

function startAnvil() {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve("@foundry-rs/anvil/package.json");
  return spawn(
    process.execPath,
    [
      join(dirname(packagePath), "bin.mjs"),
      "--host",
      "127.0.0.1",
      "--port",
      String(PORT),
      "--chain-id",
      String(LOCAL_OPPORTUNITY_CHAIN_ID),
      "--silent",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

async function waitForAnvil(
  client: ReturnType<typeof createPublicClient>,
  process: ChildProcess,
) {
  let startupError = "";
  process.stderr?.on("data", (chunk) => {
    startupError += chunk.toString();
  });
  for (let attempt = 0; attempt < 30; attempt++) {
    if (process.exitCode !== null)
      throw new Error(`Anvil exited during startup: ${startupError.trim()}`);
    try {
      if ((await client.getChainId()) === LOCAL_OPPORTUNITY_CHAIN_ID) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Anvil did not start: ${startupError.trim()}`);
}

function compileFixtureRuntime(): Hex {
  if (runtime) return runtime;
  const source = readFileSync(
    join(process.cwd(), "contracts/fixtures/OpportunityToken.sol"),
    "utf8",
  );
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "OpportunityToken.sol": { content: source } },
        settings: {
          optimizer: { enabled: true, runs: 200 },
          outputSelection: {
            "*": { "*": ["evm.deployedBytecode.object"] },
          },
        },
      }),
    ),
  );
  const errors = (output.errors ?? []).filter(
    (entry: { severity: string }) => entry.severity === "error",
  );
  if (errors.length) throw new Error("Fixture Solidity compilation failed.");
  runtime =
    `0x${output.contracts["OpportunityToken.sol"].OpportunityToken.evm.deployedBytecode.object}` as Hex;
  return runtime;
}
