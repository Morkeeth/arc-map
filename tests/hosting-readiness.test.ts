import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("check:hosting reports mechanical readiness without authorizing deploy", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/check-hosting-readiness.ts"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.ok(String(report.note).includes("Does not authorize deploy"));
  assert.ok(report.optionalNotRequired.includes("HUNTER_EXECUTOR_PRIVATE_KEY"));
});
