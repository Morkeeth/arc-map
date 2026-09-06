import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MissionStore } from "../src/lib/mission-store";
import { runHunter } from "../src/lib/hunter-runner";
import { missionForReturn } from "../src/lib/mission-return";
import type { Mission } from "../src/lib/hunters";

const ADDRESS = "0x02A0545E0f6Dce7E0Fb68Bc4ed0e9688e29e6Ee1";
const TX_A = `0x${"a".repeat(64)}`;
const TX_B = `0x${"b".repeat(64)}`;

function fixtureFetch() {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    let body: unknown = {};
    if (url.includes("/counters")) {
      body = { token_holders_count: "12", transfers_count: "2" };
    } else if (url.includes("/transfers")) {
      body = {
        items: [
          {
            from: { hash: `0x${"1".repeat(40)}` },
            to: { hash: `0x${"2".repeat(40)}` },
            transaction_hash: TX_A,
            log_index: 0,
            block_number: 100,
            timestamp: "2026-09-06T10:00:00.000Z",
          },
          {
            from: { hash: `0x${"3".repeat(40)}` },
            to: { hash: `0x${"4".repeat(40)}` },
            transaction_hash: TX_B,
            log_index: 1,
            block_number: 101,
            timestamp: "2026-09-06T11:00:00.000Z",
          },
        ],
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response;
  };
}

test("returning owner reopens completed Hunt with source-backed evidence; stranger empty", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arcmap-return-hunt-"));
  const path = join(dir, "missions.sqlite");
  process.env.ARCMAP_MISSIONS_DB = path;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = fixtureFetch() as typeof fetch;

  try {
    const store = new MissionStore(path);
    const created = store.create("returning-owner", {
      projectId: "sun-token",
      provider: "explorer",
      budget: "0.05",
    });
    const running = store.claim("returning-owner", created.id);
    const report = await runHunter(running);
    const finished = store.finish("returning-owner", created.id, report, null);
    assert.equal(finished.status, "reported");
    assert.ok(finished.reportHash);
    assert.ok(finished.report);
    const txs = finished.report.evidence.map((row) => row.transaction);
    assert.ok(txs.includes(TX_A));
    assert.ok(txs.includes(TX_B));
    assert.equal(finished.report.stance, "limited-support");
    assert.ok(finished.report.conclusion.includes("more than one transaction"));
    store.close();

    const returned = new MissionStore(path);
    const list = returned.list("returning-owner");
    const selected = missionForReturn(list);
    assert.ok(selected);
    assert.equal(selected.id, finished.id);
    assert.equal(selected.status, "reported");
    assert.equal(selected.reportHash, finished.reportHash);
    assert.deepEqual(
      selected.report?.evidence.map((row) => row.transaction),
      [TX_A, TX_B],
    );
    assert.equal(returned.list("stranger").length, 0);
    assert.equal(returned.get("stranger", finished.id), null);
    assert.equal(
      missionForReturn(returned.list("stranger")),
      null,
    );
    returned.close();
  } finally {
    globalThis.fetch = previousFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("missionForReturn prefers deep-link id then newest reported", () => {
  const older = { id: "older", status: "reported" } as Mission;
  const newer = { id: "newer", status: "reported" } as Mission;
  const blocked = { id: "blocked", status: "blocked" } as Mission;
  assert.equal(missionForReturn([newer, older], "older")?.id, "older");
  assert.equal(missionForReturn([newer, older])?.id, "newer");
  assert.equal(missionForReturn([blocked])?.id, "blocked");
  assert.equal(missionForReturn([]), null);
});
