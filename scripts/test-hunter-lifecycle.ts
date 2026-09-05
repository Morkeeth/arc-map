import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  keccak256,
  toHex,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import { foundry } from "viem/chains";
import { MissionStore } from "../src/lib/mission-store";
import { runHunter } from "../src/lib/hunter-runner";
import { escrowAbi } from "../src/lib/escrow";

// Isolated local EVM only. Never loads a user key or sends an Arc transaction.
async function main() {
  const port = 18547;
  const rpc = `http://127.0.0.1:${port}`;
  const node = spawn(
    process.env.ANVIL_BIN || "anvil",
    ["--host", "127.0.0.1", "--port", String(port), "--silent"],
    { stdio: "ignore" },
  );
  let nodeFailed = false;
  node.on("error", () => {
    nodeFailed = true;
  });
  node.on("exit", () => {
    nodeFailed = true;
  });
  const dir = mkdtempSync(join(tmpdir(), "arcmap-lifecycle-"));
  const store = new MissionStore(join(dir, "missions.sqlite"));
  try {
    const client = createPublicClient({
      chain: foundry,
      transport: http(rpc, { retryCount: 0, timeout: 1000 }),
    });
    let ready = false;
    for (let i = 0; i < 30; i++) {
      if (nodeFailed)
        throw new Error(
          "Isolated Anvil failed to start; no existing node will be used.",
        );
      try {
        ready = (await client.getChainId()) === 31337;
        if (ready) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, "Local chain did not start");
    const control = createWalletClient({
      chain: foundry,
      transport: http(rpc),
    });
    const [owner, executor, service] = await control.getAddresses();
    const artifact = JSON.parse(
      readFileSync(
        join(process.cwd(), "contracts/out/HunterEscrow.sol/HunterEscrow.json"),
        "utf8",
      ),
    );
    const deployed = await control.deployContract({
      account: owner,
      abi: escrowAbi,
      bytecode: artifact.bytecode.object as Hex,
    });
    const deployment = await client.waitForTransactionReceipt({
      hash: deployed,
    });
    assert.equal(deployment.status, "success");
    const address = deployment.contractAddress as Address;
    const mission = store.create("local-integration", {
      projectId: "sun-token",
      provider: "explorer",
      budget: "0.05",
    });
    const report = await runHunter(
      store.claim("local-integration", mission.id),
    );
    const done = store.finish("local-integration", mission.id, report, null);
    assert.equal(done.reportHash, keccak256(toHex(JSON.stringify(report))));
    async function mined(hash: Hex) {
      const receipt = await client.waitForTransactionReceipt({ hash });
      assert.equal(receipt.status, "success");
      return receipt;
    }
    const funding = await mined(
      await control.writeContract({
        account: owner,
        address,
        abi: escrowAbi,
        functionName: "openMission",
        value: parseEther(mission.budget),
        args: [
          mission.id as Hex,
          mission.thesisHash,
          done.reportHash!,
          executor,
          service,
          parseEther(mission.fee),
          BigInt(mission.deadline),
        ],
      }),
    );
    assert.equal(
      parseEventLogs({
        abi: escrowAbi,
        logs: funding.logs,
        eventName: "MissionOpened",
      }).length,
      1,
    );
    await assert.rejects(
      client.simulateContract({
        account: owner,
        address,
        abi: escrowAbi,
        functionName: "completeMission",
        args: [mission.id as Hex, done.reportHash!],
      }),
    );
    const before = await client.getBalance({ address: service });
    const payment = await mined(
      await control.writeContract({
        account: executor,
        address,
        abi: escrowAbi,
        functionName: "completeMission",
        args: [mission.id as Hex, done.reportHash!],
      }),
    );
    assert.equal(
      (await client.getBalance({ address: service })) - before,
      parseEther(mission.fee),
    );
    const completion = parseEventLogs({
      abi: escrowAbi,
      logs: payment.logs,
      eventName: "MissionCompleted",
    })[0];
    assert.equal(completion.args.reportHash, done.reportHash);
    await assert.rejects(
      client.simulateContract({
        account: executor,
        address,
        abi: escrowAbi,
        functionName: "completeMission",
        args: [mission.id as Hex, done.reportHash!],
      }),
    );
    const refund = await mined(
      await control.writeContract({
        account: owner,
        address,
        abi: escrowAbi,
        functionName: "closeMission",
        args: [mission.id as Hex],
      }),
    );
    assert.equal(
      parseEventLogs({
        abi: escrowAbi,
        logs: refund.logs,
        eventName: "MissionClosed",
      })[0].args.refund,
      parseEther("0.04"),
    );
    assert.equal(await client.getBalance({ address }), 0n);
    console.log(
      JSON.stringify(
        {
          network: "isolated local Anvil, NOT Arc testnet",
          evidenceProvider: report.provider,
          events: report.sampleSize,
          transactions: report.transactions,
          reportHash: done.reportHash,
          proofs: [
            "live explorer research",
            "durable report commitment",
            "funding event",
            "unauthorized executor rejected",
            "fixed fee paid",
            "report hash matches receipt",
            "duplicate settlement rejected",
            "surplus reclaimed",
          ],
          localReceipts: {
            deployment: deployed,
            funding: funding.transactionHash,
            payment: payment.transactionHash,
            refund: refund.transactionHash,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    store.close();
    node.kill("SIGTERM");
    rmSync(dir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
