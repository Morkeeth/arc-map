import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  encodeFunctionData,
  getAddress,
  keccak256,
  parseEther,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { arcTestnet } from "viem/chains";
import { escrowAbi } from "../src/lib/escrow";
import {
  missionFundingPolicy,
  verifyFundingReceiptObservation,
} from "../src/lib/mission-chain";
import { MissionStore } from "../src/lib/mission-store";
import type {
  FundingReceiptObservation,
  PreparedMissionTransaction,
} from "../src/lib/funding-types";
import type { Mission, MissionReport } from "../src/lib/hunters";

const address = (label: string): Address =>
  getAddress(`0x${keccak256(toHex(label)).slice(-40)}`);
const account = address("privy-linked-account");
const escrow = address("testnet-escrow");
const executor = address("executor");
const service = address("service");
const now = Date.parse("2026-09-08T10:00:00.000Z");

function graphReport(): MissionReport {
  return {
    version: 1,
    hunter: "distribution",
    thesis: "Does sampled activity extend beyond one transaction?",
    conclusion: "The bounded sample has distinct transactions.",
    stance: "limited-support",
    provider: "graph",
    source: "Graph fixture endpoint",
    observedAt: new Date(now - 30_000).toISOString(),
    indexedBlock: 60_000_000,
    sampleSize: 2,
    transactions: 2,
    firstEventAt: null,
    lastEventAt: null,
    evidence: [],
    observations: [],
    limitations: ["A bounded sample does not establish independent demand."],
    steps: [],
  };
}

function mission(): Mission {
  const report = graphReport();
  return {
    id: keccak256(toHex("browser mission")),
    hunterId: "distribution",
    projectId: "sun-token",
    address: address("sun"),
    thesis: report.thesis,
    thesisHash: keccak256(toHex("browser thesis")),
    provider: "graph",
    createdAt: new Date(now - 60_000).toISOString(),
    deadline: Math.floor(now / 1_000) + 86_400,
    budget: "0.05",
    fee: "0.01",
    status: "reported",
    report,
    reportHash: keccak256(toHex(JSON.stringify(report))),
    error: null,
  };
}

function intent(row = mission()): PreparedMissionTransaction {
  const data = encodeFunctionData({
    abi: escrowAbi,
    functionName: "openMission",
    args: [
      row.id as Hex,
      row.thesisHash,
      row.reportHash!,
      executor,
      service,
      parseEther(row.fee),
      BigInt(row.deadline),
    ],
  });
  const policy = missionFundingPolicy(
    row,
    account,
    escrow,
    executor,
    service,
    data,
    now,
  );
  return {
    to: escrow,
    data,
    value: parseEther(row.budget).toString(),
    chainId: arcTestnet.id,
    account,
    action: "fund",
    simulatedAt: policy.preparedAt,
    expiresAt: policy.expiresAt,
    policy,
  };
}

function observation(
  row = mission(),
  prepared = intent(row),
): FundingReceiptObservation {
  const policy = prepared.policy!;
  return {
    chainId: arcTestnet.id,
    receiptStatus: "success",
    transactionHash: keccak256(toHex("transaction")),
    transaction: {
      from: account,
      to: escrow,
      input: prepared.data,
      value: BigInt(prepared.value),
    },
    blockNumber: 100n,
    blockHash: keccak256(toHex("block")),
    blockTimestamp: Math.floor(now / 1_000) + 30,
    currentBlockNumber: 101n,
    opened: {
      missionId: row.id as Hex,
      owner: account,
      thesisHash: row.thesisHash,
      budget: BigInt(policy.amount),
      fee: BigInt(policy.fee),
      executor,
      service,
      deadline: BigInt(row.deadline),
    },
  };
}

test("verified receipt binds Privy account, exact action, event and evidence", () => {
  const row = mission();
  const prepared = intent(row);
  const receipt = verifyFundingReceiptObservation(
    row,
    prepared,
    observation(row, prepared),
    "2026-09-08T10:01:00.000Z",
  );
  assert.equal(receipt.status, "active");
  assert.equal(receipt.account, account);
  assert.equal(receipt.amount, parseEther("0.05").toString());
  assert.equal(receipt.reportHash, row.reportHash);
  assert.equal(receipt.confirmations, 2);
});

test("wrong account, wrong chain, changed calldata and failed receipt refuse", () => {
  const row = mission();
  const prepared = intent(row);
  const base = observation(row, prepared);
  assert.throws(
    () =>
      verifyFundingReceiptObservation(row, prepared, {
        ...base,
        transaction: { ...base.transaction, from: address("wrong") },
      }),
    /account/,
  );
  assert.throws(
    () =>
      verifyFundingReceiptObservation(row, prepared, {
        ...base,
        chainId: 1,
      }),
    /wrong chain/,
  );
  assert.throws(
    () =>
      verifyFundingReceiptObservation(row, prepared, {
        ...base,
        transaction: { ...base.transaction, input: "0x12345678" },
      }),
    /calldata/,
  );
  assert.throws(
    () =>
      verifyFundingReceiptObservation(row, prepared, {
        ...base,
        receiptStatus: "reverted",
      }),
    /failed.*inactive/,
  );
});

test("expired policy and changed report commitment refuse", () => {
  const row = mission();
  const prepared = intent(row);
  const base = observation(row, prepared);
  assert.throws(
    () =>
      verifyFundingReceiptObservation(row, prepared, {
        ...base,
        blockTimestamp: Math.floor(Date.parse(prepared.expiresAt) / 1_000) + 1,
      }),
    /expired/,
  );
  assert.throws(
    () =>
      verifyFundingReceiptObservation(
        { ...row, reportHash: keccak256(toHex("changed report")) },
        prepared,
        base,
      ),
    /evidence commitment changed/,
  );
});

test("unsupported evidence cannot become a funding policy", () => {
  const row = mission();
  row.report = { ...row.report!, stance: "not-supported" };
  assert.throws(
    () =>
      missionFundingPolicy(
        row,
        account,
        escrow,
        executor,
        service,
        "0x12345678",
        now,
      ),
    /Graph-backed report commitment/,
  );
});

test("prepared policy and active receipt survive workspace restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "arcmap-funding-receipt-"));
  const path = join(dir, "missions.sqlite");
  try {
    const first = new MissionStore(path);
    const created = first.create("owner", {
      projectId: "sun-token",
      provider: "graph",
      budget: "0.05",
    });
    first.claim("owner", created.id);
    const completed = first.finish("owner", created.id, graphReport(), null);
    const prepared = intent(completed);
    first.saveFundingIntent("owner", created.id, prepared, now);
    const receipt = verifyFundingReceiptObservation(
      completed,
      prepared,
      observation(completed, prepared),
    );
    first.saveFundingReceipt("owner", created.id, receipt);
    assert.equal(first.get("other", created.id), null);
    first.close();

    const restarted = new MissionStore(path);
    const reopened = restarted.get("owner", created.id);
    assert.match(
      reopened?.coverageDecision?.id ?? "",
      /^coverage-[a-f0-9]{24}$/,
    );
    assert.equal(
      reopened?.coverageDecision?.reportHash,
      reopened?.reportHash,
    );
    assert.equal(reopened?.fundingIntent?.policy?.bindingHash, receipt.bindingHash);
    assert.equal(reopened?.fundingReceipt?.status, "active");
    assert.equal(reopened?.fundingReceipt?.transactionHash, receipt.transactionHash);
    restarted.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
