// Single-service entrypoint: one container, one process tree, one volume.
// Runs the standalone Next.js server and the existing worker supervisor
// (scripts/workers.ts: ingest, radar, theses) side by side.
//
// Why this exists: Railway attaches a volume to exactly one service and turns a
// compose file into separate services, so four services cannot share one SQLite
// directory. This process owns .data alone.
//
// Lifecycle: SIGTERM/SIGINT is forwarded to both children. If the web server
// exits on its own the whole process exits non-zero so the platform restarts
// the container. If the worker supervisor exits on its own it is relaunched
// after two seconds; the supervisor already restarts its own children.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

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

let shuttingDown = false;
let web;
let workers;
let workersRestart;

function log(line) {
  process.stdout.write(`[serve-all ${new Date().toISOString()}] ${line}\n`);
}

function startWeb() {
  web = spawn(process.execPath, [server], { env, stdio: "inherit" });
  log(`web pid ${web.pid} port ${env.PORT}`);
  web.on("exit", (code, signal) => {
    if (shuttingDown) return;
    log(`web exited (${code ?? signal}); exiting so the platform restarts the container`);
    stopWorkers();
    process.exit(code ?? 1);
  });
}

function startWorkers() {
  workers = spawn(
    process.execPath,
    ["--import", "tsx", resolve(root, "scripts/workers.ts")],
    { env, stdio: "inherit" },
  );
  log(`workers supervisor pid ${workers.pid}`);
  workers.on("exit", (code, signal) => {
    if (shuttingDown) return;
    log(`workers supervisor exited (${code ?? signal}); relaunch in 2s`);
    workersRestart = setTimeout(startWorkers, 2000);
  });
}

function stopWorkers() {
  if (workersRestart) clearTimeout(workersRestart);
  if (workers && workers.exitCode === null) workers.kill("SIGTERM");
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`received ${signal}; stopping web and workers`);
  stopWorkers();
  if (web && web.exitCode === null) web.kill(signal);
  const deadline = setTimeout(() => process.exit(0), 8000);
  deadline.unref();
  let left = [web, workers].filter((c) => c && c.exitCode === null).length;
  if (left === 0) process.exit(0);
  for (const c of [web, workers]) {
    if (c && c.exitCode === null) c.once("exit", () => { if (--left === 0) process.exit(0); });
  }
}
for (const s of ["SIGTERM", "SIGINT"]) process.on(s, () => shutdown(s));

startWeb();
startWorkers();
