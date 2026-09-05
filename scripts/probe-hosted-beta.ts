#!/usr/bin/env npx tsx
/**
 * Hosted-beta probe — what can stand without Oscar secrets.
 * Does not purchase hosting or publish a public URL.
 *
 *   npx tsx scripts/probe-hosted-beta.ts
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, cpSync } from "node:fs";
import { join } from "node:path";

type Row = {
  id: string;
  status: "PASS" | "BLOCKED" | "FAIL";
  detail: string;
  missing?: string[];
};

const rows: Row[] = [];

function record(row: Row) {
  rows.push(row);
  console.log(`${row.status.padEnd(7)} ${row.id} — ${row.detail}`);
}

async function waitFor(url: string, ms = 20000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok || res.status < 500) return res.status;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  // 1. Production build artifact
  if (existsSync(join(process.cwd(), ".next/standalone/server.js")))
    record({
      id: "standalone-artifact",
      status: "PASS",
      detail: ".next/standalone/server.js present after npm run build",
    });
  else
    record({
      id: "standalone-artifact",
      status: "FAIL",
      detail: "standalone server.js missing — run npm run build",
    });

  // 2. Compose file validates as YAML structure (daemon may be absent)
  if (existsSync("compose.yaml") && existsSync("Dockerfile"))
    record({
      id: "compose-files",
      status: "PASS",
      detail: "compose.yaml + Dockerfile present (config is not a deployment)",
    });
  else
    record({
      id: "compose-files",
      status: "FAIL",
      detail: "compose/Dockerfile missing",
    });

  // 3. Docker daemon
  try {
    const { spawnSync } = await import("node:child_process");
    const docker = spawnSync("docker", ["info"], { encoding: "utf8" });
    if (docker.status === 0)
      record({ id: "docker-daemon", status: "PASS", detail: "docker info ok" });
    else
      record({
        id: "docker-daemon",
        status: "BLOCKED",
        detail: "docker binary/daemon unavailable in this environment",
        missing: ["docker CLI + daemon"],
      });
  } catch {
    record({
      id: "docker-daemon",
      status: "BLOCKED",
      detail: "docker not installed",
      missing: ["docker"],
    });
  }

  // 4. Secrets / env required for a real public beta
  const missingEnv = [
    "NEXT_PUBLIC_APP_ORIGIN", // must be real public HTTPS origin for Privy
    "GRAPH_TRANSFERS_URL",
    "HUNTER_ESCROW_ADDRESS",
    "HUNTER_ESCROW_CODE_HASH",
    "HUNTER_EXECUTOR_ADDRESS",
    "HUNTER_SERVICE_ADDRESS",
    "ARCMAP_AGENT_TOKEN",
  ].filter((k) => !process.env[k]);
  record({
    id: "runtime-secrets",
    status: missingEnv.length ? "BLOCKED" : "PASS",
    detail: missingEnv.length
      ? `missing ${missingEnv.length} env keys for funded/public beta`
      : "required runtime env present",
    missing: missingEnv.length ? missingEnv : undefined,
  });

  // 5. Host account / public URL — never invent
  record({
    id: "public-host-account",
    status: "BLOCKED",
    detail:
      "No hosting account, domain or spend authorization in this run. Compose bind is localhost:3117 only.",
    missing: [
      "Oscar hosting account",
      "TLS-terminated public origin",
      "spend authorization",
    ],
  });

  // 6. Secret scan of tracked sources + client bundle samples
  const leaks: string[] = [];
  const scanRoots = ["src", "scripts", "docs", "fixtures"];
  const banned =
    /(PRIVATE_KEY\s*=\s*0x[0-9a-fA-F]{64}|BEGIN (RSA |OPENSSH )?PRIVATE KEY|sk_live_[a-zA-Z0-9]+)/;
  for (const root of scanRoots) {
    if (!existsSync(root)) continue;
    const walk = (dir: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, name.name);
        if (name.isDirectory()) walk(path);
        else if (/\.(ts|tsx|js|md|json|yaml|yml|example)$/.test(name.name)) {
          const text = readFileSync(path, "utf8");
          if (banned.test(text)) leaks.push(path);
        }
      }
    };
    walk(root);
  }
  record({
    id: "secret-scan-tracked",
    status: leaks.length ? "FAIL" : "PASS",
    detail: leaks.length
      ? `possible secret material in ${leaks.join(", ")}`
      : "no private-key patterns in scanned tracked paths",
  });

  // 7. Standalone Node production smoke on an ephemeral port
  const port = 3127;
  const packaged = join(process.cwd(), ".next/standalone");
  const standalone = join(packaged, "server.js");
  if (existsSync(standalone)) {
    if (existsSync(join(process.cwd(), ".next/static")))
      cpSync(join(process.cwd(), ".next/static"), join(packaged, ".next/static"), {
        recursive: true,
      });
    const child = spawn(process.execPath, [standalone], {
      cwd: packaged,
      env: {
        ...process.env,
        PORT: String(port),
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3107",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      await waitFor(`http://127.0.0.1:${port}/`);
      const paths = ["/", "/hunters", "/agents", "/api/hunters", "/api/integrations"];
      const statuses: Record<string, number> = {};
      for (const path of paths) {
        const res = await fetch(`http://127.0.0.1:${port}${path}`);
        statuses[path] = res.status;
        assert.ok(res.status < 500, `${path} returned ${res.status}`);
      }
      record({
        id: "standalone-http-smoke",
        status: "PASS",
        detail: `node .next/standalone/server.js on :${port} → ${JSON.stringify(statuses)}`,
      });
    } catch (error) {
      record({
        id: "standalone-http-smoke",
        status: "FAIL",
        detail: error instanceof Error ? error.message : String(error),
      });
    } finally {
      child.kill("SIGTERM");
    }
  }

  const blocked = rows.filter((r) => r.status === "BLOCKED");
  const failed = rows.filter((r) => r.status === "FAIL");
  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        passed: rows.filter((r) => r.status === "PASS").length,
        blocked: blocked.length,
        failed: failed.length,
        blockedMissing: [...new Set(blocked.flatMap((r) => r.missing || []))],
      },
      null,
      2,
    ),
  );
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
