import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { readThesisEvidence } from "../src/lib/thesis-evidence";
import { ThesisStore } from "../src/lib/thesis-store";
import { describeThesisCriterion } from "../src/lib/thesis-types";

// Match other local probes: load existing .env.local without printing secrets.
if (existsSync(".env.local")) {
  const local = parseEnv(readFileSync(".env.local", "utf8"));
  for (const [key, value] of Object.entries(local)) process.env[key] ??= value;
}

const directory = mkdtempSync(join(tmpdir(), "arcmap-graph-revisit-"));
const store = new ThesisStore(join(directory, "theses.sqlite"));

async function main() {
try {
  if (!process.env.GRAPH_TRANSFERS_URL) {
    console.log(
      JSON.stringify(
        {
          status: "unavailable",
          provider: "The Graph",
          schema: "Transfer",
          chain: "Arc testnet",
          chainId: 5042002,
          target: "SUN",
          reason:
            "GRAPH_TRANSFERS_URL is not configured. Explorer was not substituted.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
  } else {
    const baseline = await readThesisEvidence(
      "sun-token",
      "graph-transfer-event",
    );
    const thesis = store.create(
      "replay",
      {
        projectId: "sun-token",
        claim:
          "I will revisit if The Graph returns a later Transfer event for this exact SUN contract.",
        metric: "graph-transfer-event",
        hours: 8,
        checks: 2,
        intervalMinutes: 15,
      },
      baseline,
    );
    const latest = await readThesisEvidence(
      "sun-token",
      "graph-transfer-event",
    );
    const lease = store.claim("replay", thesis.id);
    const result = store.finish(
      "replay",
      thesis.id,
      lease.token,
      latest,
      null,
    );
    const check = store.checks("replay", thesis.id)[0];
    console.log(
      JSON.stringify(
        {
          status: "completed",
          provider: "The Graph",
          schema: "Transfer",
          chain: "Arc testnet",
          chainId: 5042002,
          criterion: describeThesisCriterion(thesis).statement,
          baseline: baseline.provenance,
          baselineRetrievedAt: baseline.observedAt,
          latest: latest.provenance,
          latestRetrievedAt: latest.observedAt,
          met: check.met,
          observation: check.observation,
          thesisStatus: result.status,
          note:
            "Two live bounded reads. Indexed-block or retrieval-time progress alone does not satisfy the condition.",
        },
        null,
        2,
      ),
    );
  }
} catch (error) {
  console.log(
    JSON.stringify(
      {
        status: "unavailable",
        provider: "The Graph",
        schema: "Transfer",
        chain: "Arc testnet",
        chainId: 5042002,
        target: "SUN",
        reason:
          error instanceof Error
            ? error.message
            : "Graph revisit failed without a valid result.",
        note: "Explorer was not substituted.",
      },
      null,
      2,
    ),
  );
  process.exitCode = 2;
} finally {
  store.close();
  rmSync(directory, { recursive: true, force: true });
}
}

void main();
