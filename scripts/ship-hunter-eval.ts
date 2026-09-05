#!/usr/bin/env npx tsx
/**
 * Ship Hunter eval — evidence arm vs naive latest-tag arm.
 *
 * Cold clone, no key:
 *   npx tsx scripts/ship-hunter-eval.ts --offline
 *
 * Live GitHub (network):
 *   npx tsx scripts/ship-hunter-eval.ts --live
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import {
  parseGitHubReleases,
  summarizeReleases,
  inspectReleases,
  clearReleaseCache,
  type ReleaseObservation,
} from "../src/lib/providers/releases";
import { evaluateShipClaim, type ShipClaimReport } from "../src/lib/ship-claim";

type Case = {
  id: string;
  projectId: string;
  repository: string;
  claim: string;
  observation: ReleaseObservation;
  expectEvidence: ShipClaimReport["evidence"]["stance"];
  expectNaive?: ShipClaimReport["naive"]["stance"];
  expectDisagreement?: boolean;
};

function fromFixture(
  projectId: string,
  repository: string,
  payload: unknown,
  observedAt = "2026-09-05T08:00:00.000Z",
) {
  return summarizeReleases(
    projectId,
    repository,
    `fixture://${repository}/releases`,
    parseGitHubReleases(payload, repository),
    observedAt,
  );
}

function score(report: ShipClaimReport) {
  // Conservative correctness: over-claiming support is a miss; insufficient on empty is a hit.
  const evidenceOk =
    report.evidence.stance !== "limited-support" ||
    (report.evidence.matchedTag !== null && report.sampleSize > 0);
  return { evidenceOk, naiveSupport: report.naive.stance === "limited-support" };
}

async function offlineCases(): Promise<Case[]> {
  const dir = join(process.cwd(), "fixtures/ship-hunter");
  const arc = JSON.parse(readFileSync(join(dir, "arc-node-releases.json"), "utf8"));
  const agent = JSON.parse(
    readFileSync(join(dir, "agent-stack-releases.json"), "utf8"),
  );
  const adv = JSON.parse(readFileSync(join(dir, "adversarial.json"), "utf8"));
  return [
    {
      id: "arc-packaged-release",
      projectId: "arc-node",
      repository: "circlefin/arc-node",
      claim: "arc-node published v0.8.0 with linux binaries",
      observation: fromFixture("arc-node", "circlefin/arc-node", arc),
      expectEvidence: "limited-support",
      expectNaive: "limited-support",
    },
    {
      id: "agent-stack-empty",
      projectId: "circle-agent-stack",
      repository: "circlefin/agent-stack-starter-kits",
      claim: "Agent Stack shipped v1.0.0 with starter-kit binaries",
      observation: fromFixture(
        "circle-agent-stack",
        "circlefin/agent-stack-starter-kits",
        agent,
      ),
      expectEvidence: "insufficient-evidence",
      expectNaive: "insufficient-evidence",
    },
    {
      id: "tag-only-trap",
      projectId: "arc-node",
      repository: "circlefin/arc-node",
      claim: "operators can download v9.9.9 from the release",
      observation: fromFixture("arc-node", "circlefin/arc-node", adv.tagOnly),
      expectEvidence: "not-supported",
      expectNaive: "limited-support",
      expectDisagreement: true,
    },
    {
      id: "draft-trap",
      projectId: "arc-node",
      repository: "circlefin/arc-node",
      claim: "v1.2.3 is published for production use",
      observation: fromFixture("arc-node", "circlefin/arc-node", adv.draftOnly),
      expectEvidence: "not-supported",
    },
    {
      id: "live-object-v0.6.0-zero-assets",
      projectId: "arc-node",
      repository: "circlefin/arc-node",
      claim: "operators can download v0.6.0 binaries from the release page",
      observation: fromFixture("arc-node", "circlefin/arc-node", adv.liveV060NoAssets),
      expectEvidence: "not-supported",
      expectNaive: "limited-support",
      expectDisagreement: true,
    },
    {
      id: "no-token-title-rank",
      projectId: "arc-node",
      repository: "circlefin/arc-node",
      claim: "This repository looks extremely active and important",
      observation: fromFixture("arc-node", "circlefin/arc-node", adv.withAssets),
      expectEvidence: "insufficient-evidence",
      expectNaive: "insufficient-evidence",
    },
  ];
}

async function liveCases(): Promise<Case[]> {
  clearReleaseCache();
  const arc = await inspectReleases("arc-node");
  const agent = await inspectReleases("circle-agent-stack");
  const latest = arc.releases.find((r) => !r.draft && r.publishedAt && r.binaryAssets > 0);
  assert.ok(latest, "Live arc-node should expose at least one published release with binaries");
  return [
    {
      id: "live-arc-latest",
      projectId: "arc-node",
      repository: arc.repository,
      claim: `arc-node published ${latest.tag} with downloadable binaries`,
      observation: arc,
      expectEvidence: "limited-support",
    },
    {
      id: "live-arc-v0.6.0-no-assets",
      projectId: "arc-node",
      repository: arc.repository,
      claim: "operators can download v0.6.0 binaries from the release page",
      observation: arc,
      expectEvidence: "not-supported",
      expectNaive: "not-supported",
      // Latest tag is not v0.6.0, so naive misses; evidence finds the tag but refuses zero assets.
    },
    {
      id: "live-agent-stack-empty-or-real",
      projectId: "circle-agent-stack",
      repository: agent.repository,
      claim: "Agent Stack shipped v1.0.0 with starter-kit binaries",
      observation: agent,
      expectEvidence:
        agent.releases.length === 0 ? "insufficient-evidence" : "not-supported",
    },
  ];
}

function printCase(c: Case, report: ShipClaimReport) {
  console.log(`\n=== ${c.id} ===`);
  console.log(`claim: ${c.claim}`);
  console.log(
    `sample: ${report.sampleSize} releases · published=${c.observation.publishedCount} · withBinaries=${c.observation.withBinaries}`,
  );
  console.log(`evidence: ${report.evidence.stance} — ${report.evidence.conclusion}`);
  console.log(`naive:    ${report.naive.stance} — ${report.naive.conclusion}`);
  console.log(
    `winner: ${report.winner}${report.disagreement ? " (disagreement)" : ""}`,
  );
}

async function main() {
  const mode = process.argv.includes("--live")
    ? "live"
    : process.argv.includes("--offline")
      ? "offline"
      : null;
  if (!mode) {
    console.error("Usage: npx tsx scripts/ship-hunter-eval.ts --offline|--live");
    process.exit(2);
  }
  const cases = mode === "live" ? await liveCases() : await offlineCases();
  let evidenceHits = 0;
  let naiveOverclaims = 0;
  let disagreements = 0;
  for (const c of cases) {
    const report = evaluateShipClaim(c.observation, c.claim);
    printCase(c, report);
    assert.equal(
      report.evidence.stance,
      c.expectEvidence,
      `${c.id} evidence stance`,
    );
    if (c.expectNaive) assert.equal(report.naive.stance, c.expectNaive, `${c.id} naive`);
    if (c.expectDisagreement) assert.equal(report.disagreement, true, `${c.id} disagreement`);
    const s = score(report);
    if (s.evidenceOk) evidenceHits += 1;
    if (report.disagreement && s.naiveSupport && report.evidence.stance !== "limited-support")
      naiveOverclaims += 1;
    if (report.disagreement) disagreements += 1;
  }
  console.log("\n--- summary (re-derived this run, not carried from docs) ---");
  console.log(
    JSON.stringify(
      {
        mode,
        cases: cases.length,
        evidenceHits,
        disagreements,
        naiveOverclaims,
        note:
          naiveOverclaims > 0
            ? "Naive latest-tag arm over-claimed relative to release objects. That is the finding."
            : "No naive over-claim on this case set.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
