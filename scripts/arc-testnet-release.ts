/** Explicit, resumable operator verification. No keys, wallet data or raw signed bytes in logs. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, openSync, closeSync, unlinkSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import assert from "node:assert/strict";
import { createPublicClient, createWalletClient, http, parseEther, formatEther, keccak256, encodeDeployData, parseEventLogs, type Hex, type Address } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { escrowAbi } from "../src/lib/escrow";
import { prepareMissionAction, missionChainState } from "../src/lib/mission-chain";
import { MissionStore } from "../src/lib/mission-store";
import { runHunter } from "../src/lib/hunter-runner";

const dir = join(process.cwd(), ".data/arc-testnet-release");
const secrets = join(homedir(), ".config/arc-map/secrets");
let stage = "preflight";
const mode = process.argv[2];
if (!["--deploy", "--lifecycle"].includes(mode)) throw new Error("Use --deploy or --lifecycle; both explicitly broadcast testnet transactions.");
mkdirSync(dir, { recursive: true, mode: 0o700 });
const lock = join(dir, "run.lock");
const lockFd = openSync(lock, "wx", 0o600);
const stateFile = join(dir, "state.json");
type Entry = { hash: Hex; maximum: string; status: string; gasCost?: string };
type State = { owner?: Address; executor?: Address; escrow?: Address; codeHash?: Hex; missionId?: string; reportHash?: Hex; transactions: Record<string, Entry> };
const state: State = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : { transactions: {} };
function save() {
  writeFileSync(stateFile + ".tmp", JSON.stringify(state, null, 2), { mode: 0o600 });
  renameSync(stateFile + ".tmp", stateFile);
}
function emit(value: unknown) { console.log(JSON.stringify(value)); }
function loadKey(file: string, name: string) {
  const value = parseEnv(readFileSync(join(secrets, file), "utf8"))[name];
  assert.ok(value, "Saved key is missing");
  assert.ok(/^(0x)?[0-9a-fA-F]{64}$/.test(value || ""), "Invalid saved key format");
  return privateKeyToAccount((value.startsWith("0x") ? value : "0x" + value) as Hex);
}
async function main() {
  Object.assign(process.env, parseEnv(readFileSync(".env.local", "utf8")));
  const client = createPublicClient({ chain: arcTestnet, transport: http(undefined, { timeout: 15000, retryCount: 0 }) });
  assert.equal(await client.getChainId(), 5042002);
  const owner = loadKey("wallet.env", "WALLET_CREDENTIAL");
  // Generated once, not copied from the owner; kept outside the repo with owner-only permissions.
  const executorFile = join(secrets, "hunter-executor.env");
  if (!existsSync(executorFile)) writeFileSync(executorFile, `HUNTER_EXECUTOR_PRIVATE_KEY=${generatePrivateKey()}\n`, { flag: "wx", mode: 0o600 });
  const executor = loadKey("hunter-executor.env", "HUNTER_EXECUTOR_PRIVATE_KEY");
  if (state.owner) assert.equal(state.owner, owner.address);
  if (state.executor) assert.equal(state.executor, executor.address);
  state.owner = owner.address;
  state.executor = executor.address;
  save();
  async function transact(label: string, account: typeof owner, tx: { to?: Address; data?: Hex; value?: bigint }) {
    stage = label;
    let entry = state.transactions[label];
    if (!entry) {
      assert.equal(await client.getChainId(), 5042002);
      const block = await client.getBlock();
      assert.ok(Math.abs(Date.now() / 1000 - Number(block.timestamp)) < 120);
      await client.call({ account, ...tx });
      const estimate = await client.estimateGas({ account, ...tx });
      const gas = estimate * 125n / 100n;
      const fees = await client.estimateFeesPerGas();
      assert.ok(fees.maxFeePerGas && fees.maxPriorityFeePerGas !== undefined);
      const maximum = gas * fees.maxFeePerGas + (tx.value || 0n);
      const reserved = Object.values(state.transactions).reduce((sum, row) => sum + BigInt(row.maximum), 0n);
      assert.ok(reserved + maximum <= parseEther("1"), "Total authorized cap exceeded");
      assert.ok(await client.getBalance({ address: account.address }) >= maximum, "Insufficient testnet balance");
      const wallet = createWalletClient({ account, chain: arcTestnet, transport: http() });
      const request = await wallet.prepareTransactionRequest({ ...tx, gas, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas });
      const signed = await wallet.signTransaction(request);
      const hash = keccak256(signed);
      entry = { hash, maximum: maximum.toString(), status: "prepared" };
      state.transactions[label] = entry;
      save(); // Intent/hash persisted BEFORE broadcast. Unknown outcomes never trigger a new nonce.
      const returned = await client.sendRawTransaction({ serializedTransaction: signed });
      assert.equal(returned, hash);
      entry.status = "broadcast";
      save();
    }
    const receipt = await client.waitForTransactionReceipt({ hash: entry.hash, confirmations: 2, timeout: 90000 });
    entry.status = receipt.status;
    entry.gasCost = (receipt.gasUsed * receipt.effectiveGasPrice).toString();
    save();
    assert.equal(receipt.status, "success");
    emit({ step: label, network: "Arc testnet", hash: receipt.transactionHash, gasUSDC: formatEther(BigInt(entry.gasCost)) });
    return receipt;
  }
  const artifact = JSON.parse(readFileSync("contracts/out/HunterEscrow.sol/HunterEscrow.json", "utf8"));
  const expectedCodeHash = keccak256(artifact.deployedBytecode.object);
  if (!state.escrow) {
    assert.equal(mode, "--deploy", "Deploy explicitly first");
    const deployment = await transact("deploy", owner, { data: encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode.object }) });
    assert.ok(deployment.contractAddress);
    state.escrow = deployment.contractAddress;
    state.codeHash = expectedCodeHash;
    save();
  }
  stage = "verify-runtime";
  const code = await client.getCode({ address: state.escrow });
  assert.ok(code && keccak256(code) === expectedCodeHash && expectedCodeHash === state.codeHash);
  const config = {
    HUNTER_ESCROW_ADDRESS: state.escrow,
    HUNTER_ESCROW_CODE_HASH: state.codeHash!,
    HUNTER_EXECUTOR_ADDRESS: executor.address,
    HUNTER_SERVICE_ADDRESS: executor.address,
  };
  Object.assign(process.env, config);
  // Mechanical env update: public deployment configuration only, no private signer.
  let local = readFileSync(".env.local", "utf8");
  for (const [key, value] of Object.entries(config)) {
    local = local.replace(new RegExp(`^${key}=.*\\n?`, "gm"), "");
    local += `${key}=${value}\n`;
  }
  writeFileSync(".env.local", local, { mode: 0o600 });
  emit({ deploymentVerified: true, escrow: state.escrow, chainId: 5042002 });
  if (mode === "--deploy") return;
  stage = "graph-research";
  const store = new MissionStore(join(dir, "missions.sqlite"));
  try {
    let mission = state.missionId ? store.get("authorized-testnet-run", state.missionId) : null;
    // An unfunded stale preview is retained for audit; create a new immutable mission instead.
    if (!mission || (!state.transactions.fund && mission.report && Date.now() - Date.parse(mission.report.observedAt) > 10 * 60_000)) {
      mission = store.create("authorized-testnet-run", { projectId: "sun-token", provider: "graph", budget: "0.05" });
      state.missionId = mission.id;
      save();
    }
    if (!mission.report) {
      const report = await runHunter(store.claim("authorized-testnet-run", mission.id));
      mission = store.finish("authorized-testnet-run", mission.id, report, null);
    }
    state.reportHash = mission.reportHash!;
    save();
    writeFileSync(join(dir, "mission.json"), JSON.stringify(mission, null, 2), { mode: 0o600 });
    emit({ provider: mission.provider, sampledEvents: mission.report!.sampleSize, indexedBlock: mission.report!.indexedBlock, reportHash: mission.reportHash });
    if (!state.transactions.fund) {
      stage = "fund-simulation";
      const prepared = await prepareMissionAction(mission, "fund", owner.address);
      await transact("fund", owner, { to: prepared.to, data: prepared.data, value: BigInt(prepared.value) });
    } else await transact("fund", owner, {});
    // The executor and payee are the same dedicated service account for this test.
    if (!state.transactions["executor-gas"]) await transact("executor-gas", owner, { to: executor.address, value: parseEther("0.02") });
    else await transact("executor-gas", owner, {});
    stage = "settlement-simulation";
    const { encodeFunctionData } = await import("viem");
    if (!state.transactions.settle) {
      await assert.rejects(client.simulateContract({ account: owner, address: state.escrow, abi: escrowAbi, functionName: "completeMission", args: [mission.id as Hex, mission.reportHash!] }));
      const data = encodeFunctionData({ abi: escrowAbi, functionName: "completeMission", args: [mission.id as Hex, mission.reportHash!] });
      await transact("settle", executor, { to: state.escrow, data });
    } else await transact("settle", executor, {});
    const chain = await missionChainState(mission);
    assert.ok(chain.completed && chain.reportMatches);
    await assert.rejects(client.simulateContract({ account: executor, address: state.escrow, abi: escrowAbi, functionName: "completeMission", args: [mission.id as Hex, mission.reportHash!] }));
    if (!state.transactions.refund) {
      const prepared = await prepareMissionAction(mission, "close", owner.address);
      const refund = await transact("refund", owner, { to: prepared.to, data: prepared.data });
      assert.equal(parseEventLogs({ abi: escrowAbi, logs: refund.logs, eventName: "MissionClosed" })[0].args.refund, parseEther("0.04"));
    } else await transact("refund", owner, {});
    const final = await missionChainState(mission);
    assert.ok(final.closed && final.completed && final.reportMatches && BigInt(final.remaining) === 0n);
    const reserved = Object.values(state.transactions).reduce((s, tx) => s + BigInt(tx.maximum), 0n);
    const gasCost = Object.values(state.transactions).reduce((s, tx) => s + BigInt(tx.gasCost || "0"), 0n);
    emit({ verified: true, network: "Arc testnet", provider: "graph", reportMatches: true, funded: "0.05", fee: "0.01", reclaimed: "0.04", executorGasAllocation: "0.02", totalGas: formatEther(gasCost), conservativeSpendCeiling: formatEther(reserved), privyBrowserVerified: false });
  } finally { store.close(); }
}
main().catch(() => {
  console.error(`Arc testnet verification stopped at ${stage}. Private details were not logged. Inspect the private run state before retrying; the 1-USDC cap remains enforced.`);
  process.exitCode = 1;
}).finally(() => { closeSync(lockFd); unlinkSync(lock); });
