import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { probeIntegrations } from "../src/lib/integration-health";

// One authorized payment lifecycle, not a general spending daemon. Six-hour maximum.
// It must run from the project root and never passes a key in arguments/environment.
Object.assign(process.env, parseEnv(readFileSync(".env.local", "utf8")));
const end = Date.now() + 6 * 60 * 60_000;
const statusFile = ".data/arc-testnet-release/watch-status.json";
async function main() {
  while (Date.now() < end) {
    const state = JSON.parse(readFileSync(".data/arc-testnet-release/state.json", "utf8"));
    if (state.transactions.refund?.status === "success") {
      console.log("Authorized Arc testnet lifecycle already complete; watcher stopped.");
      return;
    }
    const health = await probeIntegrations();
    writeFileSync(statusFile, JSON.stringify({ checkedAt: new Date().toISOString(), expiresAt: new Date(end).toISOString(), health, status: "waiting-for-fresh-index" }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ checkedAt: health.checkedAt, indexedBlock: health.graph.indexedBlock, fresh: health.graph.fresh }));
    if (health.fundingPrerequisitesMet) {
      if (existsSync(".data/arc-testnet-release/run.lock")) throw new Error("Another release process holds the lock.");
      const run = spawnSync(process.execPath, ["--import", "tsx", "scripts/arc-testnet-release.ts", "--lifecycle"], { stdio: "inherit", timeout: 600000 });
      writeFileSync(statusFile, JSON.stringify({ checkedAt: new Date().toISOString(), status: run.status === 0 ? "completed" : "stopped-needs-inspection", exitCode: run.status }, null, 2), { mode: 0o600 });
      if (run.status !== 0) process.exitCode = 1;
      return; // Never retry an uncertain broadcast automatically.
    }
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  }
  writeFileSync(statusFile, JSON.stringify({ checkedAt: new Date().toISOString(), status: "expired-without-funding" }), { mode: 0o600 });
  console.log("Index did not become fresh during the authorized watch window. No new funding attempted.");
}
main().catch(() => { console.error("Release watcher stopped; inspect local status. No automatic retry."); process.exitCode = 1; });
