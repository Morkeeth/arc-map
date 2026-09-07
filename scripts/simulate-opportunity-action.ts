import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createPublicClient,
  createTestClient,
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  http,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { foundry } from "viem/chains";
import solc from "solc";
import {
  erc20BalanceSlot,
  LOCAL_OPPORTUNITY_CHAIN_ID,
  prepareOpportunityAction,
  simulateOpportunityAction,
  type OpportunityActionRequest,
} from "../src/lib/opportunity-action";

const port = 18_553;
const rpcUrl = `http://127.0.0.1:${port}`;
const asset = fixtureAddress("opportunity-token");
const reportContract = fixtureAddress("evidence-report-contract");
const alternateAccount = fixtureAddress("wrong-selected-account");

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const baseRequest = requestFor(
    "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    now,
  );
  const request = process.argv.includes("--wrong-account")
    ? { ...baseRequest, account: alternateAccount }
    : baseRequest;
  const naiveCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [request.target, request.amount],
  });

  let prepared;
  try {
    prepared = prepareOpportunityAction(request, now);
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          status: "rejected-before-simulation",
          simulationRpcStarted: false,
          reason: error instanceof Error ? error.message : String(error),
          baseline: {
            name: "ABI encoding only",
            accepted: Boolean(naiveCalldata),
            limitation:
              "The naive encoder accepts the same calldata without checking account, evidence, target policy or expiry.",
          },
        },
        null,
        2,
      ),
    );
    throw error;
  }

  let anvil: ChildProcess | undefined;
  try {
    anvil = startAnvil();
    const publicClient = createPublicClient({
      chain: foundry,
      transport: http(rpcUrl, { retryCount: 0, timeout: 1_000 }),
    });
    await waitForAnvil(publicClient, anvil);
    const accounts = await (
      publicClient.request as unknown as (args: {
        method: "eth_accounts";
      }) => Promise<Address[]>
    )({ method: "eth_accounts" });
    assert.ok(accounts.length > 0, "Local EVM must expose a fixture account");
    const selected = getAddress(accounts[0]);
    assert.equal(
      selected.toLowerCase(),
      prepared.account.toLowerCase(),
      "Selected account must come from the local EVM fixture",
    );

    const testClient = createTestClient({
      chain: foundry,
      mode: "anvil",
      transport: http(rpcUrl),
    });
    await testClient.setCode({
      address: asset,
      bytecode: compileFixtureRuntime(),
    });
    const startingBalance = 1_000_000n;
    await testClient.setStorageAt({
      address: asset,
      index: erc20BalanceSlot(selected),
      value: toHex(startingBalance, { size: 32 }),
    });

    const receipt = await simulateOpportunityAction(
      publicClient as unknown as Parameters<
        typeof simulateOpportunityAction
      >[0],
      prepared,
    );
    assert.equal(receipt.pin.chainId, LOCAL_OPPORTUNITY_CHAIN_ID);
    assert.deepEqual(
      receipt.deltas.map((delta) => delta.delta),
      [-prepared.amount, prepared.amount],
    );
    assert.equal(
      decodeFunctionResult({
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
      }),
      true,
    );

    console.log(
      JSON.stringify(
        {
          ...receipt,
          baseline: {
            name: "ABI encoding only",
            accepted: Boolean(naiveCalldata),
            decodedAssetDeltas: false,
          },
          fixture: {
            tokenRuntimeInjected: true,
            initialAccountBalance: startingBalance,
            reportContractCodeRequired: false,
          },
          limitations: [
            "Isolated Anvil fixture only; this is not an Arc, testnet or mainnet receipt.",
            "debug_traceCall state differences are simulated and are not persisted.",
            "The evidence references are deterministic test fixtures, not a live opportunity finding.",
          ],
        },
        (_, value) => (typeof value === "bigint" ? value.toString() : value),
        2,
      ),
    );
  } finally {
    anvil?.kill("SIGTERM");
  }
}

function requestFor(account: Address, now: number): OpportunityActionRequest {
  return {
    account,
    asset,
    target: reportContract,
    amount: 25_000n,
    evidence: {
      reportId: "local-fixture-report",
      source: "contracts/fixtures/OpportunityToken.sol",
      observedAt: new Date(now * 1_000).toISOString(),
      counterevidence:
        "A successful fixture transfer does not show that a public-chain target is safe or useful.",
    },
    policy: {
      chainId: LOCAL_OPPORTUNITY_CHAIN_ID,
      account,
      asset,
      reportContract,
      amountCeiling: 30_000n,
      expiresAt: now + 600,
    },
  };
}

function fixtureAddress(label: string): Address {
  return getAddress(`0x${keccak256(toHex(label)).slice(-40)}`);
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
      String(port),
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
  const path = join(
    process.cwd(),
    "contracts/fixtures/OpportunityToken.sol",
  );
  const source = readFileSync(path, "utf8");
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: {
          "OpportunityToken.sol": { content: source },
        },
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
  assert.deepEqual(errors, [], "Fixture Solidity compilation must succeed");
  const object =
    output.contracts["OpportunityToken.sol"].OpportunityToken.evm
      .deployedBytecode.object;
  assert.match(object, /^[0-9a-f]+$/i);
  return `0x${object}`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
