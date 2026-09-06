import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function main() {
  const major = Number(process.versions.node.split(".")[0]);
  assert.ok(major >= 22, `Node 22+ required; got ${process.versions.node}`);

  for (const path of [
    ".env.example",
    "Dockerfile",
    "docs/HOSTING-READINESS.md",
    "package.json",
    "scripts/workers.ts",
  ]) {
    assert.ok(existsSync(path), `missing ${path}`);
  }

  const envExample = readFileSync(".env.example", "utf8");
  for (const key of [
    "NEXT_PUBLIC_APP_ORIGIN",
    "GRAPH_TRANSFERS_URL",
    "ARCMAP_AGENT_TOKEN",
  ]) {
    assert.ok(envExample.includes(key), `.env.example must document ${key}`);
  }
  assert.ok(
    /NEXT_PUBLIC_APP_ORIGIN=http:\/\/localhost:3107/.test(envExample),
    "default origin should remain local until an authorized host is chosen",
  );

  const dockerfile = readFileSync("Dockerfile", "utf8");
  assert.ok(dockerfile.includes("node:22"), "Dockerfile must pin Node 22");
  assert.ok(dockerfile.includes("standalone"), "web image expects Next standalone output");

  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts?.workers, "tsx scripts/workers.ts");
  assert.ok(pkg.scripts?.["check:hosting"], "check:hosting script required");

  // Ensure the supervised worker entry still exists for the hosting checklist.
  require.resolve("../scripts/workers.ts");

  const report = {
    ok: true,
    node: process.versions.node,
    checklist: "docs/HOSTING-READINESS.md",
    note: "Mechanical readiness only. Does not authorize deploy, spend or public DNS.",
    optionalNotRequired: [
      "GRAPH_TRANSFERS_URL",
      "HUNTER_ESCROW_ADDRESS",
      "HUNTER_EXECUTOR_PRIVATE_KEY",
      "ARCMAP_AGENT_TOKEN",
    ],
  };
  console.log(JSON.stringify(report, null, 2));
}

main();
