import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { FollowStore } from "../src/lib/follow-store";
import { followedChanges } from "../src/lib/follow-service";
import { WorkerStatusStore } from "../src/lib/worker-status";

const SHA = "a".repeat(40);
const MESSAGE = "supervised returning-user source probe";
const SOURCE_URL = `https://github.com/circlefin/arc-node/commit/${SHA}`;

test(
  "returning user sees source-backed change from supervised ingest after follow; stranger empty",
  { timeout: 45_000 },
  async () => {
    const data = mkdtempSync(join(tmpdir(), "arcmap-return-sup-"));
    const preload = join(data, "fixture-sources.cjs");
    writeFileSync(
      preload,
      `
const sha = ${JSON.stringify(SHA)};
const message = ${JSON.stringify(MESSAGE)};
const counters = { token_holders_count: "3", transfers_count: "11" };
const radar = { items: [] };
global.fetch = async (input) => {
  const url = String(input);
  let body;
  if (url.includes("api.github.com/repos/") && url.includes("/commits")) {
    body = [{ sha, commit: { message, committer: { date: "2026-09-06T12:00:00.000Z" } } }];
  } else if (url.includes("testnet.arcscan.app/api/v2/tokens/") && url.includes("/counters")) {
    body = counters;
  } else if (url.includes("testnet.arcscan.app/api/v2/")) {
    body = radar;
  } else {
    body = {};
  }
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
};
`,
    );

    const env = {
      ...process.env,
      NODE_OPTIONS: `--require=${preload}`,
      ARCMAP_DB_PATH: join(data, "arcmap.sqlite"),
      ARCMAP_WORKER_STATUS_DB: join(data, "worker-status.sqlite"),
      ARCMAP_RADAR_DB: join(data, "radar.sqlite"),
      ARCMAP_MISSIONS_DB: join(data, "missions.sqlite"),
      ARCMAP_THESES_DB: join(data, "theses.sqlite"),
      ARCMAP_INGEST_INTERVAL_MS: "60000",
      ARCMAP_RADAR_INTERVAL_MS: "60000",
    };
    Object.assign(process.env, {
      ARCMAP_DB_PATH: env.ARCMAP_DB_PATH,
      ARCMAP_WORKER_STATUS_DB: env.ARCMAP_WORKER_STATUS_DB,
      ARCMAP_RADAR_DB: env.ARCMAP_RADAR_DB,
      ARCMAP_MISSIONS_DB: env.ARCMAP_MISSIONS_DB,
      ARCMAP_THESES_DB: env.ARCMAP_THESES_DB,
    });

    // Follow before any supervised cycle so the baseline is empty heads.
    const follows = new FollowStore(env.ARCMAP_MISSIONS_DB);
    follows.follow("returning-owner", "arc-node", { feed: 0, radar: 0 });
    follows.close();
    assert.equal(
      followedChanges("returning-owner").events.length,
      0,
      "baseline must be quiet before supervised ingest",
    );

    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/workers.ts"],
      { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] },
    );

    try {
      let sawEvent = false;
      for (let i = 0; i < 40; i++) {
        await sleep(1000);
        assert.equal(child.exitCode, null, "supervisor exited early");
        const status = new WorkerStatusStore(env.ARCMAP_WORKER_STATUS_DB);
        const ingest = status.listExpected().find((row) => row.name === "ingest");
        status.close();
        if (ingest?.lastSuccess) {
          const returned = followedChanges("returning-owner");
          const update = returned.events.find(
            (event) => event.sourceUrl === SOURCE_URL,
          );
          if (update) {
            assert.equal(update.projectId, "arc-node");
            assert.equal(update.title, MESSAGE);
            assert.equal(followedChanges("other-owner").events.length, 0);
            assert.equal(followedChanges("other-owner").follows.length, 0);
            sawEvent = true;
            break;
          }
        }
      }
      assert.equal(
        sawEvent,
        true,
        "supervised ingest must publish a source-backed change for the returning owner",
      );
    } finally {
      try {
        process.kill(child.pid!, "SIGTERM");
      } catch {}
      await sleep(1200);
      rmSync(data, { recursive: true, force: true });
    }
  },
);
