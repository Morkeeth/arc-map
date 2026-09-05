import type { ObservedRelease, ReleaseObservation } from "./providers/releases";

export type ShipStance = "limited-support" | "not-supported" | "insufficient-evidence";

export type ClaimMatch = {
  release: ObservedRelease;
  matchedTokens: string[];
  reasons: string[];
};

export type ArmVerdict = {
  arm: "evidence" | "naive-tag";
  stance: ShipStance;
  conclusion: string;
  matchedTag: string | null;
  reasons: string[];
};

export type ShipClaimReport = {
  claim: string;
  tokens: string[];
  observedAt: string;
  sampleSize: number;
  evidence: ArmVerdict;
  naive: ArmVerdict;
  disagreement: boolean;
  winner: "evidence" | "naive-tag" | "tie" | "both-insufficient";
  limitations: string[];
};

/** Extract version-like and quoted tokens from a shipping claim. Re-derived at the claim string. */
export function claimTokens(claim: string): string[] {
  if (typeof claim !== "string") throw new Error("Claim must be a string.");
  const trimmed = claim.trim();
  if (trimmed.length < 8 || trimmed.length > 400)
    throw new Error("Claim must be 8–400 characters.");
  const found = new Set<string>();
  for (const m of trimmed.matchAll(/\bv?\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9.-]+)?\b/g))
    found.add(m[0].toLowerCase());
  for (const m of trimmed.matchAll(/["']([A-Za-z0-9._-]{2,80})["']/g))
    found.add(m[1].toLowerCase());
  for (const m of trimmed.matchAll(/\b(v\d+(?:\.\d+){1,3})\b/gi))
    found.add(m[1].toLowerCase());
  return [...found];
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/^refs\/tags\//, "");
}

function tagMatchesToken(tag: string, token: string) {
  const t = normalizeTag(tag);
  const tok = token.toLowerCase();
  if (t === tok || t === `v${tok}` || `v${t}` === tok) return true;
  // Require token to appear as a version fragment, not a title rank by free text.
  return t.includes(tok) && /\d/.test(tok);
}

function publishedReleases(observation: ReleaseObservation) {
  return observation.releases.filter((r) => !r.draft && r.publishedAt);
}

function findTokenMatches(releases: ObservedRelease[], tokens: string[]): ClaimMatch[] {
  if (!tokens.length) return [];
  const matches: ClaimMatch[] = [];
  for (const release of releases) {
    const matchedTokens = tokens.filter(
      (tok) => tagMatchesToken(release.tag, tok) || tagMatchesToken(release.name, tok),
    );
    if (!matchedTokens.length) continue;
    const reasons: string[] = [
      `Tag ${release.tag} matched claim token(s): ${matchedTokens.join(", ")}.`,
    ];
    if (release.draft) reasons.push("Release is a draft.");
    if (release.prerelease) reasons.push("Release is marked prerelease.");
    if (!release.publishedAt) reasons.push("Release has no published_at.");
    if (release.binaryAssets === 0)
      reasons.push("No non-checksum assets were attached.");
    else
      reasons.push(
        `${release.binaryAssets} binary asset(s) and ${release.checksumAssets} checksum asset(s) attached.`,
      );
    matches.push({ release, matchedTokens, reasons });
  }
  return matches;
}

/** Naive arm: latest non-draft tag string contains a claim token. Ignores assets and draft nuance beyond skipping drafts. */
export function naiveTagArm(observation: ReleaseObservation, claim: string): ArmVerdict {
  const tokens = claimTokens(claim);
  const published = publishedReleases(observation);
  if (!observation.releases.length)
    return {
      arm: "naive-tag",
      stance: "insufficient-evidence",
      conclusion: "No releases were returned. Naive tag matching has nothing to score.",
      matchedTag: null,
      reasons: ["Empty release list."],
    };
  if (!tokens.length)
    return {
      arm: "naive-tag",
      stance: "insufficient-evidence",
      conclusion: "Claim has no version-like token for naive tag matching.",
      matchedTag: null,
      reasons: ["No version tokens extracted."],
    };
  if (!published.length)
    return {
      arm: "naive-tag",
      stance: "not-supported",
      conclusion: "No non-draft published releases exist for naive tag match.",
      matchedTag: null,
      reasons: ["Only drafts or unpublished rows present."],
    };
  const latest = published[0];
  const hit = tokens.find((tok) => tagMatchesToken(latest.tag, tok) || tagMatchesToken(latest.name, tok));
  if (hit)
    return {
      arm: "naive-tag",
      stance: "limited-support",
      conclusion: `Naive arm: latest published tag ${latest.tag} contains claim token ${hit}. Assets and deploy state were not checked.`,
      matchedTag: latest.tag,
      reasons: [`Matched latest tag only.`, `Ignored asset count (${latest.binaryAssets}).`],
    };
  return {
    arm: "naive-tag",
    stance: "not-supported",
    conclusion: `Naive arm: latest published tag ${latest.tag} does not contain claim tokens ${tokens.join(", ")}.`,
    matchedTag: null,
    reasons: ["Latest-tag string mismatch."],
  };
}

/** Evidence arm: open the release object — publish time, draft/prerelease, assets. */
export function evidenceArm(observation: ReleaseObservation, claim: string): ArmVerdict {
  const tokens = claimTokens(claim);
  if (!observation.releases.length)
    return {
      arm: "evidence",
      stance: "insufficient-evidence",
      conclusion:
        "GitHub returned zero releases for this sourced repository. Shipping cannot be assessed from an empty list.",
      matchedTag: null,
      reasons: ["Empty release list is not a green zero."],
    };
  if (!tokens.length)
    return {
      arm: "evidence",
      stance: "insufficient-evidence",
      conclusion:
        "Claim has no version-like or quoted token to match against release tags. Refusing to rank by free-text title.",
      matchedTag: null,
      reasons: ["No matchable tokens; title-rank forbidden."],
    };

  const publishedMatches = findTokenMatches(publishedReleases(observation), tokens).filter(
    (m) => m.release.binaryAssets > 0,
  );
  if (publishedMatches.length) {
    const best = publishedMatches[0];
    return {
      arm: "evidence",
      stance: "limited-support",
      conclusion: `Observed published release ${best.release.tag} with ${best.release.binaryAssets} binary asset(s) at ${best.release.publishedAt}. This supports a source packaging claim, not network deployment.`,
      matchedTag: best.release.tag,
      reasons: best.reasons,
    };
  }

  const tagOnly = findTokenMatches(publishedReleases(observation), tokens);
  if (tagOnly.length) {
    const best = tagOnly[0];
    return {
      arm: "evidence",
      stance: "not-supported",
      conclusion: `Tag ${best.release.tag} matches the claim token but has no binary assets. A tag name alone is not a shipped package.`,
      matchedTag: best.release.tag,
      reasons: best.reasons,
    };
  }

  const draftMatches = findTokenMatches(
    observation.releases.filter((r) => r.draft),
    tokens,
  );
  if (draftMatches.length) {
    const best = draftMatches[0];
    return {
      arm: "evidence",
      stance: "not-supported",
      conclusion: `Only draft release ${best.release.tag} matches the claim. Drafts are not published shipping evidence.`,
      matchedTag: best.release.tag,
      reasons: best.reasons,
    };
  }

  return {
    arm: "evidence",
    stance: "not-supported",
    conclusion: `No observed release tag matched claim tokens ${tokens.join(", ")} among ${observation.publishedCount} published release(s).`,
    matchedTag: null,
    reasons: [
      `Published releases examined: ${publishedReleases(observation)
        .map((r) => r.tag)
        .join(", ") || "(none)"}.`,
    ],
  };
}

function pickWinner(evidence: ArmVerdict, naive: ArmVerdict): ShipClaimReport["winner"] {
  if (evidence.stance === "insufficient-evidence" && naive.stance === "insufficient-evidence")
    return "both-insufficient";
  if (evidence.stance === naive.stance) return "tie";
  // Prefer the arm that stays conservative when the other over-claims support.
  if (naive.stance === "limited-support" && evidence.stance !== "limited-support")
    return "evidence";
  if (evidence.stance === "limited-support" && naive.stance !== "limited-support")
    return "evidence";
  return evidence.stance === naive.stance ? "tie" : "evidence";
}

export function evaluateShipClaim(
  observation: ReleaseObservation,
  claim: string,
): ShipClaimReport {
  const tokens = claimTokens(claim);
  const evidence = evidenceArm(observation, claim);
  const naive = naiveTagArm(observation, claim);
  const winner = pickWinner(evidence, naive);
  return {
    claim: claim.trim(),
    tokens,
    observedAt: observation.observedAt,
    sampleSize: observation.releases.length,
    evidence,
    naive,
    disagreement: evidence.stance !== naive.stance,
    winner,
    limitations: [
      ...observation.limitations,
      "Evidence arm requires a published non-draft release with at least one non-checksum asset for limited-support.",
      "Naive arm matches only the latest published tag string; it can over-claim when assets are missing.",
      "Neither arm proves Arc network deployment, users or adoption.",
    ],
  };
}
