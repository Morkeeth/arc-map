import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decodeFunctionData,
  erc20Abi,
  getAddress,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem";
import {
  LOCAL_OPPORTUNITY_CHAIN_ID,
  prepareOpportunityAction,
  simulateOpportunityAction,
  type OpportunityActionRequest,
  type OpportunitySimulationClient,
} from "../src/lib/opportunity-action";

const address = (label: string): Address =>
  getAddress(`0x${keccak256(toHex(label)).slice(-40)}`);
const account = address("selected-account");
const asset = address("fixture-token");
const reportContract = address("report-contract");
const now = 1_800_000_000;

function request(): OpportunityActionRequest {
  return {
    account,
    asset,
    target: reportContract,
    amount: 25n,
    evidence: {
      reportId: "report-fixture",
      provider: "graph",
      source: "local test fixture",
      sourceBlock: 123,
      observedAt: "2027-01-15T08:00:00.000Z",
      counterevidence: "One successful call does not establish target safety.",
    },
    policy: {
      chainId: LOCAL_OPPORTUNITY_CHAIN_ID,
      account,
      asset,
      reportContract,
      amountCeiling: 30n,
      expiresAt: now + 60,
    },
  };
}

test("encoder binds evidence, policy, account and exact ERC-20 calldata", () => {
  const prepared = prepareOpportunityAction(request(), now);
  const decoded = decodeFunctionData({
    abi: erc20Abi,
    data: prepared.calldata,
  });

  assert.equal(decoded.functionName, "transfer");
  assert.deepEqual(decoded.args, [reportContract, 25n]);
  assert.equal(prepared.account, prepared.policy.account);
  assert.equal(prepared.asset, prepared.policy.asset);
  assert.equal(prepared.target, prepared.policy.reportContract);

  const changedEvidence = prepareOpportunityAction(
    {
      ...request(),
      evidence: {
        ...request().evidence,
        counterevidence: "Different counterevidence changes the binding.",
      },
    },
    now,
  );
  assert.notEqual(prepared.bindingHash, changedEvidence.bindingHash);
});

test("wrong account, target, stale evidence, expiry and missing counterevidence fail closed", () => {
  assert.throws(
    () =>
      prepareOpportunityAction(
        {
          ...request(),
          evidence: {
            ...request().evidence,
            observedAt: new Date(
              (now - 15 * 60 - 1) * 1_000,
            ).toISOString(),
          },
        },
        now,
      ),
    /stale/,
  );
  assert.throws(
    () =>
      prepareOpportunityAction(
        { ...request(), account: address("unauthorized-account") },
        now,
      ),
    /account binding/,
  );
  assert.throws(
    () =>
      prepareOpportunityAction(
        { ...request(), target: address("stale-target") },
        now,
      ),
    /approved by policy/,
  );
  assert.throws(
    () =>
      prepareOpportunityAction(
        {
          ...request(),
          policy: { ...request().policy, expiresAt: now - 1 },
        },
        now,
      ),
    /expired/,
  );
  assert.throws(
    () =>
      prepareOpportunityAction(
        {
          ...request(),
          evidence: { ...request().evidence, counterevidence: " " },
        },
        now,
      ),
    /Counterevidence/,
  );
});

test("tampered calldata is rejected before simulation RPC", async () => {
  const currentNow = Math.floor(Date.now() / 1_000);
  let rpcCalls = 0;
  const client = new Proxy(
    {},
    {
      get() {
        return async () => {
          rpcCalls += 1;
          throw new Error("RPC must not be reached");
        };
      },
    },
  ) as OpportunitySimulationClient;
  const prepared = {
    ...prepareOpportunityAction(
      {
        ...request(),
        evidence: {
          ...request().evidence,
          observedAt: new Date(currentNow * 1_000).toISOString(),
        },
        policy: { ...request().policy, expiresAt: currentNow + 60 },
      },
      currentNow,
    ),
    calldata: "0x12345678" as Hex,
  };

  await assert.rejects(
    simulateOpportunityAction(client, prepared),
    /binding was changed/,
  );
  assert.equal(rpcCalls, 0);
});

test("opportunity route withholds rehearsal when evidence coverage withholds funding", () => {
  const route = readFileSync(
    join(
      process.cwd(),
      "src/app/api/missions/[id]/opportunity/route.ts",
    ),
    "utf8",
  );
  assert.match(route, /assessEvidenceCoverage/);
  assert.match(route, /funding === "withheld"/);
  assert.match(route, /409/);
});

test("opportunity proof sources expose no transaction-broadcast primitive", () => {
  const files = [
    "src/lib/opportunity-action.ts",
    "src/lib/opportunity-fixture.ts",
    "src/app/api/missions/[id]/opportunity/route.ts",
    "src/components/opportunity-rehearsal.tsx",
    "scripts/simulate-opportunity-action.ts",
  ];
  const forbidden =
    /\b(sendTransaction|sendRawTransaction|writeContract|deployContract|walletClient)\b/;
  for (const file of files) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    assert.doesNotMatch(source, forbidden, file);
  }
});

test("browser rehearsal exposes local-only labels, retained effects and refusal controls", () => {
  const component = readFileSync(
    join(process.cwd(), "src/components/opportunity-rehearsal.tsx"),
    "utf8",
  );
  const route = readFileSync(
    join(
      process.cwd(),
      "src/app/api/missions/[id]/opportunity/route.ts",
    ),
    "utf8",
  );
  for (const text of [
    "chain-ID-31337",
    "not Arc public-chain",
    "Wrong account",
    "Stale evidence",
    "Changed calldata",
    "Decoded fixture effects",
    "Retained local simulation receipt",
  ])
    assert.match(component, new RegExp(text, "i"));
  assert.match(route, /NEXT_PUBLIC_RESEARCH_PREVIEW/);
  assert.match(route, /simulationRpcStarted: false/);
});
