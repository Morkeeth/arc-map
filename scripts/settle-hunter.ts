import { createWalletClient, http, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { readFileSync } from "node:fs";
import { checkedChain, missionChainState } from "../src/lib/mission-chain";
import { escrowAbi } from "../src/lib/escrow";
import { keccak256, toHex } from "viem";
import type { Mission } from "../src/lib/hunters";

// Explicit operator command; never called by a public route. Uses a dedicated executor key,
// never the user's saved wallet credential. Default mode simulates without signing.
async function main() {
  const path = process.argv[2];
  if (!path)
    throw new Error(
      "Supply a private mission JSON file. Default is simulation only.",
    );
  const data = JSON.parse(readFileSync(path, "utf8"));
  const mission: Mission = data.mission;
  if (
    !mission?.report ||
    mission.provider !== "graph" ||
    mission.status !== "reported" ||
    !mission.reportHash ||
    keccak256(toHex(JSON.stringify(mission.report))) !== mission.reportHash
  )
    throw new Error(
      "A complete Graph report with a matching content hash is required.",
    );
  const { client, config } = await checkedChain();
  const state = await missionChainState(mission);
  if (
    !state.funded ||
    state.closed ||
    state.completed ||
    state.deadline < Math.floor(Date.now() / 1000)
  )
    throw new Error("Mission is not open for settlement.");
  if (state.fee !== parseEther("0.01").toString())
    throw new Error("Unexpected research fee.");
  const simulated = await client.simulateContract({
    account: config.executor!,
    address: config.address!,
    abi: escrowAbi,
    functionName: "completeMission",
    args: [mission.id as Hex, mission.reportHash],
  });
  if (!process.argv.includes("--broadcast")) {
    console.log(
      "Arc testnet settlement simulation passed. No transaction sent.",
    );
    return;
  }
  const key = process.env.HUNTER_EXECUTOR_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key))
    throw new Error("Dedicated executor key is not configured.");
  const account = privateKeyToAccount(key as Hex);
  if (account.address.toLowerCase() !== config.executor!.toLowerCase())
    throw new Error("Signer does not match mission executor.");
  const wallet = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(
      process.env.ARC_RPC_URL || arcTestnet.rpcUrls.default.http[0],
    ),
  });
  const estimate = await client.estimateContractGas({
    ...simulated.request,
    account,
  });
  const fees = await client.estimateFeesPerGas();
  if (estimate * (fees.maxFeePerGas || fees.gasPrice || 0n) > parseEther("0.1"))
    throw new Error("Estimated gas exceeds the operator ceiling.");
  const hash = await wallet.writeContract({
    address: config.address!,
    abi: escrowAbi,
    functionName: "completeMission",
    args: [mission.id as Hex, mission.reportHash],
    account,
    gas: estimate,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Settlement reverted.");
  const verified = await missionChainState(mission);
  if (!verified.completed || !verified.reportMatches)
    throw new Error("Settlement commitment did not verify.");
  console.log(
    JSON.stringify({
      chainId: arcTestnet.id,
      transaction: hash,
      reportHash: mission.reportHash,
      verified: true,
    }),
  );
}
main().catch(() => {
  console.error(
    "Settlement stopped. Check the private mission, executor configuration and chain state. No credential details are logged.",
  );
  process.exitCode = 1;
});
