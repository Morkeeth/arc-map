import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, copyFileSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const repo = resolve(import.meta.dirname, "..");
function alive(pid: number) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return false; throw error; }
}
async function until(check: () => boolean, milliseconds = 12000) {
  const end = Date.now() + milliseconds;
  while (!check()) {
    if (Date.now() >= end) throw new Error("Lifecycle condition did not arrive before deadline");
    await delay(25);
  }
}

// Real entrypoint and real subprocess groups; fixture children supply only
// controllable process exits/signals. No Next build, providers, keys or network.
for (const scenario of ["supervisor-kill", "web-zero-exit", "hung-worker"] as const) {
  test(`service lifecycle: ${scenario}`, { skip: process.platform === "win32" }, async () => {
    const root = mkdtempSync(join(tmpdir(), "arc-host-lifecycle-"));
    mkdirSync(join(root, "scripts"));
    symlinkSync(join(repo, "node_modules"), join(root, "node_modules"), "dir");
    copyFileSync(join(repo, "scripts/serve-all.mjs"), join(root, "scripts/serve-all.mjs"));
    writeFileSync(join(root, "server.js"), `process.on('SIGUSR2',()=>process.exit(0)); setInterval(()=>{},1000);`);
    writeFileSync(join(root, "scripts/worker.mjs"), `
      if(process.env.PROBE_HUNG==='1')process.on('SIGTERM',()=>console.log('fixture ignored SIGTERM'));
      console.log('fixture worker ready '+process.pid); setInterval(()=>{},1000);
    `);
    writeFileSync(join(root, "scripts/workers.ts"), `
      import {spawn} from 'node:child_process';
      const children=Array.from({length:3},(_,i)=>spawn(process.execPath,['scripts/worker.mjs'],{stdio:'inherit',env:{...process.env,PROBE_HUNG:process.env.PROBE_SCENARIO==='hung-worker'&&i===0?'1':'0'}}));
      process.on('SIGTERM',()=>{for(const child of children)child.kill('SIGTERM');setTimeout(()=>process.exit(0),50)});
      setInterval(()=>{},1000);
    `);
    let output = "";
    const service = spawn(process.execPath, [join(root, "scripts/serve-all.mjs")], {
      cwd: root,
      env: { NODE_ENV: "test", PATH: process.env.PATH, PROBE_SCENARIO: scenario },
      stdio: ["ignore", "pipe", "pipe"],
    });
    service.stdout.on("data", chunk => { output += chunk; });
    service.stderr.on("data", chunk => { output += chunk; });
    const exited = once(service, "exit");
    const workerPids = () => [...output.matchAll(/fixture worker ready (\d+)/g)].map(m => Number(m[1]));
    const groupPids = () => [...output.matchAll(/(?:web|workers supervisor) pid (\d+)/g)].map(m => Number(m[1]));
    try {
      await until(() => workerPids().length === 3);
      const supervisor = Number(output.match(/workers supervisor pid (\d+)/)![1]);
      const web = Number(output.match(/web pid (\d+)/)![1]);
      if (scenario === "supervisor-kill") process.kill(supervisor, "SIGKILL");
      else if (scenario === "web-zero-exit") process.kill(web, "SIGUSR2");
      else service.kill("SIGTERM");
      await until(() => service.exitCode !== null || service.signalCode !== null);
      const [code] = await exited;
      assert.equal(code, scenario === "hung-worker" ? 0 : 1, output);
      await until(() => [...workerPids(), ...groupPids()].every(pid => !alive(pid)), 1500);
      assert.equal([...output.matchAll(/workers supervisor pid/g)].length, 1, "Never launch a replacement over old workers");
      if (scenario === "web-zero-exit") assert.match(output, /web exited \(0\)/);
      if (scenario === "hung-worker") assert.match(output, /fixture ignored SIGTERM/);
    } finally {
      if (service.exitCode === null && service.signalCode === null) service.kill("SIGTERM");
      for (const pid of groupPids()) { try { process.kill(-pid, "SIGKILL"); } catch { /* group already gone */ } }
      for (const pid of workerPids()) { try { process.kill(pid, "SIGKILL"); } catch { /* already reaped */ } }
      await until(() => service.exitCode !== null || service.signalCode !== null).catch(() => service.kill("SIGKILL"));
      rmSync(root, {recursive: true, force: true});
    }
  });
}
