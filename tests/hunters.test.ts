import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { keccak256, toHex } from "viem";
import { MissionStore } from "../src/lib/mission-store";
import { missionAccess, readMissionBody } from "../src/lib/mission-access";
import { parseGraphTransfers } from "../src/lib/providers/graph-transfers";
import { buildMissionReport, runHunter } from "../src/lib/hunter-runner";
import { summarizeTransfers } from "../src/lib/analysis";

const token = "0x02A0545E0f6Dce7E0Fb68Bc4ed0e9688e29e6Ee1";
const from = `0x${"1".repeat(40)}`,
  to = `0x${"2".repeat(40)}`,
  hash = `0x${"a".repeat(64)}`;
const row = {
  token,
  from,
  to,
  transactionHash: hash,
  logIndex: "0",
  blockNumber: "20",
  blockTimestamp: "1750000000",
};
const payload = (rows: unknown[] = [row]) => ({
  data: {
    transfers: rows,
    _meta: { block: { number: 21 }, hasIndexingErrors: false },
  },
});
const input = { projectId: "sun-token", provider: "graph", budget: "0.05" };

test("Graph validates token association, indexing, numeric bounds and duplicate log identity", () => {
  assert.equal(
    parseGraphTransfers(payload([row, row]), token).transfers.length,
    1,
  );
  for (const bad of [
    { ...row, token: from },
    { ...row, blockNumber: "22" },
    { ...row, logIndex: "-1" },
    { ...row, blockTimestamp: String(Math.floor(Date.now() / 1000) + 1000) },
    { ...row, from: "not an address" },
  ])
    assert.throws(() => parseGraphTransfers(payload([bad]), token));
  assert.throws(() =>
    parseGraphTransfers(
      {
        data: {
          transfers: [],
          _meta: { block: { number: 21 }, hasIndexingErrors: true },
        },
      },
      token,
    ),
  );
  assert.throws(() =>
    parseGraphTransfers(
      { data: { transfers: [], _meta: { block: { number: 21 } } } },
      token,
    ),
  );
  assert.throws(() =>
    parseGraphTransfers(
      { errors: [{ message: "partial" }], ...payload() },
      token,
    ),
  );
});
test("Graph sample is bounded and continuation is disclosed", () => {
  const rows = Array.from({ length: 201 }, (_, i) => ({
    ...row,
    logIndex: String(i),
  }));
  const result = parseGraphTransfers(payload(rows), token);
  assert.equal(result.transfers.length, 200);
  assert.equal(result.moreAvailable, true);
  assert.throws(() =>
    parseGraphTransfers(payload([...rows, { ...row, logIndex: "202" }]), token),
  );
});
test("mission authority is private, budget constrained and report immutable", () => {
  const store = new MissionStore(":memory:");
  try {
    for (const budget of [
      "0",
      "-1",
      "0.009",
      "10.1",
      "Infinity",
      "1e0",
      "0.12345",
    ])
      assert.throws(() => store.create("alice", { ...input, budget }));
    assert.throws(() =>
      store.create("alice", { ...input, projectId: "dromos-labs" }),
    );
    const m = store.create("alice", input);
    assert.equal(store.get("bob", m.id), null);
    assert.equal(store.list("bob").length, 0);
    assert.throws(() => store.claim("bob", m.id));
    const running = store.claim("alice", m.id);
    assert.throws(() => store.claim("alice", m.id), /already running/);
    const parsed = parseGraphTransfers(payload(), token);
    const summary = summarizeTransfers({
      address: token,
      transfers: parsed.transfers,
      holderCount: null,
      transferCount: null,
      moreAvailable: false,
      fetchedAt: new Date().toISOString(),
    });
    const report = buildMissionReport(running, summary, 21);
    assert.equal(report.stance, "not-supported");
    assert.equal(
      report.source,
      "The Graph / configured ARC MAP transfer subgraph",
    );
    assert.ok(
      report.limitations.some((l) => l.includes("not a complete history")),
    );
    const done = store.finish("alice", m.id, report, null);
    assert.equal(done.reportHash, keccak256(toHex(JSON.stringify(report))));
    assert.throws(() => store.claim("alice", m.id), /immutable/);
    assert.throws(
      () => store.finish("alice", m.id, report, null),
      /not running/,
    );
  } finally {
    store.close();
  }
});
test("blocked Graph query never falls back to explorer and can be retried", async () => {
  const store = new MissionStore(":memory:");
  const previous = process.env.GRAPH_TRANSFERS_URL;
  delete process.env.GRAPH_TRANSFERS_URL;
  try {
    const m = store.create("alice", input);
    const active = store.claim("alice", m.id);
    await assert.rejects(runHunter(active), /not configured/);
    const failed = store.finish("alice", m.id, null, "Graph unavailable");
    assert.equal(failed.report, null);
    assert.equal(failed.reportHash, null);
    assert.equal(store.claim("alice", m.id).status, "researching");
  } finally {
    store.close();
    if (previous === undefined) delete process.env.GRAPH_TRANSFERS_URL;
    else process.env.GRAPH_TRANSFERS_URL = previous;
  }
});
test("private missions survive reopening the database", () => {
  const dir = mkdtempSync(join(tmpdir(), "arcmap-mission-test-"));
  try {
    const a = new MissionStore(join(dir, "test.sqlite"));
    const mission = a.create("owner", input);
    a.close();
    const b = new MissionStore(join(dir, "test.sqlite"));
    assert.deepEqual(b.get("owner", mission.id), mission);
    b.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("mutation rejects cross-origin and missing origin; owner comes from opaque cookie", () => {
  const old = process.env.NEXT_PUBLIC_APP_ORIGIN;
  process.env.NEXT_PUBLIC_APP_ORIGIN = "http://localhost:3107";
  try {
    assert.throws(() =>
      missionAccess(
        new Request("http://localhost:3107/api/missions", { method: "POST" }),
        true,
      ),
    );
    assert.throws(() =>
      missionAccess(
        new Request("http://localhost:3107/api/missions", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
        true,
      ),
    );
    const access = missionAccess(
      new Request("http://localhost:3107/api/missions", {
        method: "POST",
        headers: { origin: "http://localhost:3107" },
      }),
      true,
    );
    assert.ok(access.cookie?.includes("HttpOnly"));
    assert.ok(access.cookie?.includes("SameSite=Strict"));
    assert.equal(
      missionAccess(
        new Request("http://localhost:3107/api/missions", {
          headers: { cookie: access.cookie! },
        }),
      ).owner,
      access.owner,
    );
    // npm run dev binds 127.0.0.1 while .env.example documents localhost — both are loopback.
    const loopback = missionAccess(
      new Request("http://127.0.0.1:3107/api/missions", {
        method: "POST",
        headers: { origin: "http://127.0.0.1:3107" },
      }),
      true,
    );
    assert.ok(loopback.cookie);
    assert.throws(() =>
      missionAccess(
        new Request("http://127.0.0.1:3108/api/missions", {
          method: "POST",
          headers: { origin: "http://127.0.0.1:3108" },
        }),
        true,
      ),
    );
  } finally {
    if (old === undefined) delete process.env.NEXT_PUBLIC_APP_ORIGIN;
    else process.env.NEXT_PUBLIC_APP_ORIGIN = old;
  }
});
test("bounded body reader rejects invalid shape and oversized JSON", async () => {
  const req = (body: string) =>
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  await assert.rejects(readMissionBody(req("[]")), /object/);
  await assert.rejects(
    readMissionBody(req(JSON.stringify({ data: "x".repeat(17000) }))),
    /too large/,
  );
  assert.deepEqual(await readMissionBody(req(JSON.stringify(input))), input);
});
