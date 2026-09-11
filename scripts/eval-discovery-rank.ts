#!/usr/bin/env node
/**
 * Cold-clone friendly discovery ranking eval.
 * Compares why-NOW editorial order against a naive volume arm on the local brief.
 * Either arm can win — losing is a publishable finding.
 *
 * Usage (no keys required; uses local .data if present, else empty/unavailable):
 *   node --import tsx scripts/eval-discovery-rank.ts
 */
import { dailyBrief } from "../src/lib/daily-brief";
import { RadarStore } from "../src/lib/radar-store";
import { compareDiscoveryArms } from "../src/lib/discovery-rank";

function main() {
  let brief;
  let records = [];
  try {
    brief = dailyBrief();
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          unavailable: true,
          error: error instanceof Error ? error.message : "Brief unavailable",
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
    return;
  }
  const store = new RadarStore();
  try {
    records = store.list();
  } finally {
    store.close();
  }
  const comparison = compareDiscoveryArms(brief, records, 8);
  const payload = {
    ok: true,
    briefGeneratedAt: brief.generatedAt,
    inputRecords: brief.inputRecords,
    cardCount: brief.cards.length,
    catalogSize: records.length,
    rankingPolicy: brief.ranking,
    comparison,
  };
  console.log(JSON.stringify(payload, null, 2));
  if (comparison.winnerOnFreshness === "volume") {
    console.error(
      "BASELINE BEAT WHY-NOW on hot/warm share. That is the finding — do not bury it.",
    );
  }
}

main();
