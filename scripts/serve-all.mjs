// One service, one data directory, one owned process tree.
// The worker supervisor restarts its own workers. If the supervisor or web
// exits unexpectedly, stop the whole service nonzero so its host can restart it.
// POSIX process groups let us reclaim workers even after their parent dies.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

if (process.platform === "win32") {
  throw new Error("serve-all requires POSIX process groups (Linux or macOS).");
}
const root = resolve(process.cwd());
const dataDir = process.env.ARCMAP_DATA_DIR || resolve(root, ".data");
mkdirSync(dataDir, { recursive: true });
const env = {
  ...process.env,
  ARCMAP_DB_PATH: process.env.ARCMAP_DB_PATH || resolve(dataDir, "arcmap.sqlite"),
  ARCMAP_RADAR_DB: process.env.ARCMAP_RADAR_DB || resolve(dataDir, "radar.sqlite"),
  ARCMAP_MISSIONS_DB: process.env.ARCMAP_MISSIONS_DB || resolve(dataDir, "missions.sqlite"),
  ARCMAP_THESES_DB: process.env.ARCMAP_THESES_DB || resolve(dataDir, "theses.sqlite"),
  ARCMAP_WORKER_STATUS_DB: process.env.ARCMAP_WORKER_STATUS_DB || resolve(dataDir, "worker-status.sqlite"),
  PORT: process.env.PORT || "3000",
  HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
};
const server = existsSync(resolve(root, ".next/standalone/server.js"))
  ? resolve(root, ".next/standalone/server.js")
  : resolve(root, "server.js");
const children = [];
let shuttingDown = false;

function log(line) {
  process.stdout.write(`[serve-all ${new Date().toISOString()}] ${line}\n`);
}
function signalGroup(child, signal) {
  if (!child.pid) return;
  try { process.kill(-child.pid, signal); }
  catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}
function groupExists(child) {
  if (!child.pid) return false;
  try { process.kill(-child.pid, 0); return true; }
  catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}
async function stop(code, signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`stopping all process groups; exit ${code}`);
  for (const child of children) signalGroup(child, signal);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && children.some(groupExists)) await delay(50);
  // A hung descendant must not outlive a cleanly exited direct child.
  for (const child of children) if (groupExists(child)) signalGroup(child, "SIGKILL");
  const reapingDeadline = Date.now() + 1000;
  while (Date.now() < reapingDeadline && children.some(c => c.exitCode === null && c.signalCode === null)) await delay(25);
  process.exit(code);
}
function stopSafely(code, signal) {
  void stop(code, signal).catch(error => {
    log(`shutdown failed: ${error.message}`);
    for (const child of children) {
      try { signalGroup(child, "SIGKILL"); } catch { /* best effort after reported failure */ }
    }
    process.exit(1);
  });
}
function start(name, args) {
  const child = spawn(process.execPath, args, { env, stdio: "inherit", detached: true });
  children.push(child);
  log(`${name} pid ${child.pid}${name === "web" ? ` port ${env.PORT}` : ""}`);
  child.once("error", error => {
    log(`${name} failed to start: ${error.message}`);
    stopSafely(1);
  });
  child.once("exit", (code, signal) => {
    if (shuttingDown) return;
    log(`${name} exited (${code ?? signal}); stopping service for host restart`);
    stopSafely(code && code > 0 ? code : 1);
  });
}
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => stopSafely(0, signal));
start("web", [server]);
start("workers supervisor", ["--import", "tsx", resolve(root, "scripts/workers.ts")]);
