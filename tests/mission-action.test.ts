import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeFunctionData,
  keccak256,
  parseEther,
  toHex,
  type Address,
} from "viem";
import { escrowAbi } from "../src/lib/escrow";
import { encodeUnsignedMissionAction } from "../src/lib/mission-chain";
import type { Mission } from "../src/lib/hunters";

const account = (digit: string) => `0x${digit.repeat(40)}` as Address;
const mission = {
  id: keccak256(toHex("local mission fixture")),
  thesisHash: keccak256(toHex("local thesis fixture")),
  reportHash: keccak256(toHex("local report fixture")),
  budget: "0.05",
  fee: "0.01",
  deadline: 1_800_000_000,
} as Mission;
const authorities = {
  executor: account("1"),
  service: account("2"),
};

test("unsigned fund rehearsal uses the production escrow encoder", () => {
  const unsigned = encodeUnsignedMissionAction(
    mission,
    "fund",
    authorities,
  );
  const decoded = decodeFunctionData({
    abi: escrowAbi,
    data: unsigned.data,
  });

  assert.equal(decoded.functionName, "openMission");
  assert.deepEqual(decoded.args, [
    mission.id,
    mission.thesisHash,
    mission.reportHash,
    authorities.executor,
    authorities.service,
    parseEther(mission.fee),
    BigInt(mission.deadline),
  ]);
  assert.equal(unsigned.value, parseEther(mission.budget));
});

test("unsigned close rehearsal encodes no value", () => {
  const unsigned = encodeUnsignedMissionAction(
    mission,
    "close",
    authorities,
  );
  const decoded = decodeFunctionData({
    abi: escrowAbi,
    data: unsigned.data,
  });

  assert.equal(decoded.functionName, "closeMission");
  assert.deepEqual(decoded.args, [mission.id]);
  assert.equal(unsigned.value, 0n);
});

test("unsigned rehearsal fails closed for missing reports and unknown actions", () => {
  assert.throws(
    () =>
      encodeUnsignedMissionAction(
        { ...mission, reportHash: null },
        "fund",
        authorities,
      ),
    /committed report/,
  );
  assert.throws(
    () => encodeUnsignedMissionAction(mission, "send", authorities),
    /Unsupported wallet action/,
  );
});
