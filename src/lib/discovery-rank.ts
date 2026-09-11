import type { BriefCard, DailyBrief } from "./daily-brief";
import type { RadarRecord } from "./radar-types";
import { coolingRank } from "./why-now";

/**
 * Independent ranking arms for discovery quality checks.
 * Editorial / why-NOW order is never scored only against itself — always compare
 * a naive volume arm that any competent team would ship in two hours.
 */

export type RankArmId = "why-now" | "volume";

export type RankedLead = {
  projectId: string;
  label: string;
  arm: RankArmId;
  rank: number;
  score: number;
  scoreLabel: string;
  cooling: BriefCard["cooling"] | null;
  kind: BriefCard["kind"] | null;
  contract: string | null;
};

export type RankArmComparison = {
  comparedAt: string;
  topN: number;
  whyNow: RankedLead[];
  volume: RankedLead[];
  /** Fraction of top-N why-now leads that are still hot/warm with a real event clock. */
  whyNowHotShare: number;
  /** Fraction of top-N volume leads that are still hot/warm (often low — holders ≠ freshness). */
  volumeHotShare: number;
  /** Which arm surfaces more hot/warm leads in top-N. Tie → "tie". */
  winnerOnFreshness: "why-now" | "volume" | "tie";
  /** Overlap of project ids in top-N. */
  overlap: number;
  note: string;
};

function volumeScore(card: BriefCard, holdersByAddress: Map<string, number>): number {
  const address = card.project.contract?.toLowerCase();
  if (address && holdersByAddress.has(address)) return holdersByAddress.get(address)!;
  // Naive fallback a two-hour team would use: more retained rows = “more activity”.
  return card.observations;
}

export function rankWhyNow(cards: BriefCard[], topN = 8): RankedLead[] {
  return cards.slice(0, topN).map((card, i) => ({
    projectId: card.project.id,
    label: card.project.name,
    arm: "why-now" as const,
    rank: i + 1,
    score: coolingRank(card.cooling),
    scoreLabel: `cooling:${card.cooling}`,
    cooling: card.cooling,
    kind: card.kind,
    contract: card.project.contract || null,
  }));
}

export function rankByVolume(
  cards: BriefCard[],
  records: RadarRecord[],
  topN = 8,
): RankedLead[] {
  const holdersByAddress = new Map(
    records
      .filter((r) => typeof r.holders === "number")
      .map((r) => [r.address.toLowerCase(), r.holders as number]),
  );
  const sorted = [...cards].sort((a, b) => {
    const va = volumeScore(a, holdersByAddress);
    const vb = volumeScore(b, holdersByAddress);
    return vb - va || b.observedAt.localeCompare(a.observedAt) || a.id.localeCompare(b.id);
  });
  return sorted.slice(0, topN).map((card, i) => {
    const score = volumeScore(card, holdersByAddress);
    return {
      projectId: card.project.id,
      label: card.project.name,
      arm: "volume" as const,
      rank: i + 1,
      score,
      scoreLabel: holdersByAddress.has(card.project.contract?.toLowerCase() || "")
        ? `holders:${score}`
        : `observations:${score}`,
      cooling: card.cooling,
      kind: card.kind,
      contract: card.project.contract || null,
    };
  });
}

function hotShare(leads: RankedLead[]): number {
  if (!leads.length) return 0;
  const hot = leads.filter((l) => l.cooling === "hot" || l.cooling === "warm").length;
  return hot / leads.length;
}

export function compareDiscoveryArms(
  brief: DailyBrief,
  records: RadarRecord[],
  topN = 8,
  now = Date.now(),
): RankArmComparison {
  const whyNow = rankWhyNow(brief.cards, topN);
  const volume = rankByVolume(brief.cards, records, topN);
  const whyNowHotShare = hotShare(whyNow);
  const volumeHotShare = hotShare(volume);
  const winnerOnFreshness =
    whyNowHotShare > volumeHotShare
      ? "why-now"
      : volumeHotShare > whyNowHotShare
        ? "volume"
        : "tie";
  const whyIds = new Set(whyNow.map((l) => l.projectId));
  const overlap = volume.filter((l) => whyIds.has(l.projectId)).length;
  return {
    comparedAt: new Date(now).toISOString(),
    topN,
    whyNow,
    volume,
    whyNowHotShare,
    volumeHotShare,
    winnerOnFreshness,
    overlap,
    note:
      winnerOnFreshness === "volume"
        ? "FINDING: naive volume ranking beat why-NOW on hot/warm share in this top-N. Publish that — it is more valuable than a flattering self-score."
        : winnerOnFreshness === "why-now"
          ? "Why-NOW surfaced a higher share of hot/warm leads than holder/observation volume in this top-N. Still not an investment ranking."
          : "Arms tied on hot/warm share. Overlap and per-lead clocks matter more than the headline winner.",
  };
}
