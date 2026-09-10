/**
 * HTTP acceptance: research brief → Graph thesis → check → restart round.
 * Requires a local app on ARCMAP_TEST_ORIGIN (default http://127.0.0.1:3107).
 * Uses existing GRAPH_TRANSFERS_URL via the app; no spend/wallet/deploy.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

if (existsSync(".env.local")) {
  const local = parseEnv(readFileSync(".env.local", "utf8"));
  for (const [key, value] of Object.entries(local)) process.env[key] ??= value;
}

const origin = process.env.ARCMAP_TEST_ORIGIN || "http://127.0.0.1:3107";
const cookie = `arcmap_session=${randomBytes(32).toString("hex")}`;

async function call(path: string, body?: unknown) {
  const response = await fetch(`${origin}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: origin,
      Cookie: cookie,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function main() {
  if (!process.env.GRAPH_TRANSFERS_URL) {
    console.log(
      JSON.stringify({
        status: "unavailable",
        reason: "GRAPH_TRANSFERS_URL missing. Explorer was not substituted.",
      }),
    );
    process.exitCode = 2;
    return;
  }

  const brief = await call("/api/brief");
  assert.equal(brief.status, 200);
  assert.ok(Array.isArray(brief.data.cards) && brief.data.cards.length > 0);

  const input = {
    projectId: "sun-token",
    claim:
      "I will revisit if The Graph returns a later Transfer event for this exact SUN contract.",
    metric: "graph-transfer-event",
    hours: 8,
    checks: 1,
    intervalMinutes: 15,
  };
  const created = await call("/api/theses", input);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const thesis = created.data.thesis;
  assert.equal(thesis.metric, "graph-transfer-event");
  assert.equal(thesis.baseline.provenance.provider, "graph");
  assert.ok(thesis.baseline.provenance.indexedBlock > 0);
  assert.ok(thesis.baseline.provenance.eventTransaction);

  const checked = await call(`/api/theses/${thesis.id}`, { action: "check" });
  assert.equal(checked.status, 200, JSON.stringify(checked.data));
  assert.ok(
    ["tracking", "active", "met", "unmet", "ended", "inconclusive"].includes(
      checked.data.thesis.status,
    ),
    `unexpected status ${checked.data.thesis.status}`,
  );

  const restart = await call("/api/theses", {
    ...input,
    previousThesisId: thesis.id,
  });
  assert.equal(restart.status, 201, JSON.stringify(restart.data));
  assert.equal(
    restart.data.thesis.previousCommitment,
    thesis.commitment,
    "Restart must pin the ended/prior commitment",
  );

  // Preserve prior thesis after restart
  const prior = await call(`/api/theses/${thesis.id}`);
  assert.equal(prior.status, 200);
  assert.deepEqual(prior.data.thesis.baseline, thesis.baseline);

  console.log(
    JSON.stringify(
      {
        status: "completed",
        origin,
        provider: "The Graph",
        schema: "Transfer",
        chainId: 5042002,
        projectId: "sun-token",
        thesisId: thesis.id,
        restartId: restart.data.thesis.id,
        baseline: thesis.baseline.provenance,
        checkStatus: checked.data.thesis.status,
        remainingChecks: checked.data.thesis.remainingChecks,
        proofs: [
          "live brief",
          "graph-backed thesis create",
          "graph check",
          "restart pins prior commitment",
          "prior baseline preserved",
        ],
        limitation:
          "Local HTTP cookie workspace. No wallet, spend, deploy or visibility flip.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Graph HTTP flow failed");
  process.exitCode = 1;
});
