import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { WorkerStatusStore, type WorkerName } from "../src/lib/worker-status";

const jobs: [WorkerName, string][] = [
  ["ingest", "scripts/ingest.ts"],
  ["radar", "scripts/radar.ts"],
  ["theses", "scripts/thesis-worker.ts"],
];

const status = new WorkerStatusStore();
const children = new Map<WorkerName, ChildProcess>();
const pendingRestarts = new Map<WorkerName, NodeJS.Timeout>();
let shuttingDown = false;

function clearRestart(name: WorkerName) {
  const timer = pendingRestarts.get(name);
  if (!timer) return;
  clearTimeout(timer);
  pendingRestarts.delete(name);
}

function launch(name: WorkerName, script: string) {
  clearRestart(name);
  let child: ChildProcess;
  try {
    child = spawn(
      process.execPath,
      ["--import", "tsx", resolve(script), "--watch"],
      { stdio: "inherit", env: process.env },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Worker spawn failed.";
    status.fail(name, message);
    scheduleRestart(name, script);
    return;
  }
  children.set(name, child);
  child.once("spawn", () => {
    status.start(name, child.pid!);
  });
  child.once("error", (error) => {
    children.delete(name);
    status.stop(name);
    status.fail(name, error.message);
    scheduleRestart(name, script);
  });
  child.once("exit", (code, signal) => {
    children.delete(name);
    if (shuttingDown) return;
    // A failed spawn emits error then close/exit on some platforms. The
    // pending restart is intentionally shared, so this stays one retry.
    status.stop(name);
    status.fail(
      name,
      `Worker exited (${code === null ? signal : code}); restarting in 2 seconds.`,
    );
    scheduleRestart(name, script);
  });
}

function scheduleRestart(name: WorkerName, script: string) {
  if (shuttingDown || pendingRestarts.has(name)) return;
  // Keep the timer referenced so simultaneous child exits do not drain the
  // event loop and let the supervisor exit 0 with workers dead.
  const timer = setTimeout(() => {
    pendingRestarts.delete(name);
    if (shuttingDown) return;
    launch(name, script);
  }, 2000);
  pendingRestarts.set(name, timer);
}

for (const [name, script] of jobs) launch(name, script);

// Heartbeat keeps the supervisor alive while restart timers are pending.
const heartbeat = setInterval(() => {
  if (shuttingDown) return;
  for (const [name, script] of jobs) {
    if (!children.has(name) && !pendingRestarts.has(name)) {
      status.fail(name, "Worker missing; supervisor relaunching.");
      scheduleRestart(name, script);
    }
  }
}, 5000);

function stop() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(heartbeat);
  for (const name of pendingRestarts.keys()) clearRestart(name);
  for (const [name, child] of children) {
    status.stop(name);
    child.kill("SIGTERM");
  }
  setTimeout(() => {
    status.close();
    process.exit(0);
  }, 1000);
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
console.log(
  JSON.stringify({
    supervisor: "running",
    workers: jobs.map(([name]) => name),
    note: "Local workers only; evidence stays in SQLite.",
  }),
);
