import type { Mission } from "./hunters";
import { keccak256, toHex } from "viem";

type SampleSummary = {
  events: number;
  transactions: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
};

export type RevisitComparison = {
  previousMissionId: string;
  currentMissionId: string;
  previousReportHash: string;
  currentReportHash: string | null;
  provider: Mission["provider"];
  question: string;
  retrieval: {
    status: "completed" | "unavailable";
    baselineAt: string;
    latestAt: string | null;
    error: string | null;
  };
  coverage: {
    label: string;
    baselineSource: string;
    latestSource: string | null;
    baselineIndexedBlock: number | null;
    latestIndexedBlock: number | null;
  };
  previousStance: NonNullable<Mission["report"]>["stance"];
  currentStance: NonNullable<Mission["report"]>["stance"] | null;
  stanceChanged: boolean;
  evidenceChange: "changed" | "unchanged" | "insufficient-data";
  conclusionImpact: "changed" | "unchanged" | "insufficient-data";
  headline: string;
  finding: string;
  previousConclusion: string;
  currentConclusion: string | null;
  samples: { before: SampleSummary; after: SampleSummary | null };
  activityAfterBaseline: boolean;
  newExampleTransactions: string[];
  newSupportingEvidence: string[];
  newCounterevidence: string[];
  retainedCounterevidence: string[];
  nextAction: { label: string; detail: string; href: string };
  limitations: string[];
};

const LIMITATIONS = [
  "These are two bounded source samples, not equal-duration or complete windows. Count differences are not growth rates.",
  "New example transactions are differences between retained examples only, not every transaction in either sample.",
  "A changed conclusion follows the Hunter's stated rule. It is not a forecast score or investment recommendation.",
  "Reports remain immutable; this comparison does not replace either original report or its commitment.",
];

const sample = (report: NonNullable<Mission["report"]>): SampleSummary => ({
  events: report.sampleSize,
  transactions: report.transactions,
  firstEventAt: report.firstEventAt,
  lastEventAt: report.lastEventAt,
});

function validatePair(previous: Mission, current: Mission) {
  if (
    previous.id === current.id ||
    current.previousMissionId !== previous.id ||
    previous.address.toLowerCase() !== current.address.toLowerCase() ||
    previous.provider !== current.provider ||
    previous.hunterId !== current.hunterId ||
    previous.thesis !== current.thesis
  )
    throw new Error(
      "Choose a later mission that pins this exact contract, provider, Hunter and question.",
    );
}

function coverageLabel(mission: Mission) {
  return mission.provider === "graph"
    ? "The Graph Transfer-schema sample. Current deployed coverage is SUN only; indexed blocks and freshness remain explicit."
    : "Arcscan explorer sample. It is bounded public-source evidence, not Graph coverage or a complete provider history.";
}

function nextAction(
  current: Mission,
  newExamples: string[],
  unavailable = false,
): RevisitComparison["nextAction"] {
  if (unavailable)
    return {
      label: `Retry the same ${current.provider} Hunter after source recovery`,
      detail:
        "Keep the pinned baseline and provider fixed. A provider failure does not authorize substitution or a changed conclusion.",
      href: `/hunters?id=${encodeURIComponent(current.id)}`,
    };
  const transaction =
    newExamples[0] ?? current.report?.evidence[0]?.transaction ?? null;
  return {
    label: transaction
      ? `Inspect ${transaction.slice(0, 10)}… before the next rerun`
      : "Inspect the exact contract before the next rerun",
    detail:
      current.hunterId === "activity"
        ? "Compare the retained call's sender and calldata pattern with the baseline, then rerun Activity Hunter after another recorded source cycle."
        : "Check whether the retained transfer is minting, distribution follow-up or later independent activity, then rerun the same Distribution Hunter.",
    href: transaction
      ? `https://testnet.arcscan.app/tx/${transaction}`
      : `https://testnet.arcscan.app/address/${current.address}`,
  };
}

export function compareReports(
  previous: Mission,
  current: Mission,
): RevisitComparison {
  const baseline = previous.report;
  if (
    !baseline ||
    previous.status !== "reported" ||
    previous.reportHash !== keccak256(toHex(JSON.stringify(baseline)))
  )
    throw new Error("The pinned baseline report commitment is invalid.");
  validatePair(previous, current);

  if (!current.report || current.status === "blocked") {
    return {
      previousMissionId: previous.id,
      currentMissionId: current.id,
      previousReportHash: previous.reportHash,
      currentReportHash: null,
      provider: current.provider,
      question: current.thesis,
      retrieval: {
        status: "unavailable",
        baselineAt: baseline.observedAt,
        latestAt: null,
        error: current.error || "Latest retrieval returned no report.",
      },
      coverage: {
        label: coverageLabel(current),
        baselineSource: baseline.source,
        latestSource: null,
        baselineIndexedBlock: baseline.indexedBlock,
        latestIndexedBlock: null,
      },
      previousStance: baseline.stance,
      currentStance: null,
      stanceChanged: false,
      evidenceChange: "insufficient-data",
      conclusionImpact: "insufficient-data",
      headline: "Latest retrieval unavailable; baseline remains unrefreshed.",
      finding:
        "No later evidence was returned, so the product cannot answer what changed or revise the saved conclusion. The source failure is retained separately from worker progress.",
      previousConclusion: baseline.conclusion,
      currentConclusion: null,
      samples: { before: sample(baseline), after: null },
      activityAfterBaseline: false,
      newExampleTransactions: [],
      newSupportingEvidence: [],
      newCounterevidence: [
        `Source failure: ${current.error || "Latest retrieval returned no report."}`,
      ],
      retainedCounterevidence: [...baseline.limitations],
      nextAction: nextAction(current, [], true),
      limitations: [...LIMITATIONS],
    };
  }

  const latest = current.report;
  if (
    current.status !== "reported" ||
    !current.reportHash ||
    current.reportHash !== keccak256(toHex(JSON.stringify(latest)))
  )
    throw new Error("The latest report commitment does not match its content.");
  const baselineAt = Date.parse(baseline.observedAt);
  const latestAt = Date.parse(latest.observedAt);
  if (
    !Number.isFinite(baselineAt) ||
    !Number.isFinite(latestAt) ||
    latestAt <= baselineAt
  )
    throw new Error(
      "The comparison requires a later valid retrieval timestamp.",
    );

  const activityAfterBaseline = Boolean(
    latest.lastEventAt && Date.parse(latest.lastEventAt) > baselineAt,
  );
  const oldExamples = new Set(
    baseline.evidence.map((event) => event.transaction.toLowerCase()),
  );
  const newExamples = [
    ...new Set(
      latest.evidence.map((event) => event.transaction.toLowerCase()),
    ),
  ].filter((hash) => !oldExamples.has(hash));
  const newObservations = latest.observations.filter(
    (observation) => !baseline.observations.includes(observation),
  );
  const newLimits = latest.limitations.filter(
    (limitation) => !baseline.limitations.includes(limitation),
  );
  const stanceChanged = baseline.stance !== latest.stance;
  const insufficient =
    latest.stance === "insufficient-evidence" || latest.sampleSize === 0;
  const meaningfulEvidenceChanged =
    stanceChanged ||
    activityAfterBaseline ||
    newExamples.length > 0 ||
    newObservations.length > 0 ||
    newLimits.length > 0;
  const evidenceChange = insufficient
    ? "insufficient-data"
    : meaningfulEvidenceChanged
      ? "changed"
      : "unchanged";
  const conclusionImpact = insufficient
    ? "insufficient-data"
    : stanceChanged
      ? "changed"
      : "unchanged";
  const newSupportingEvidence = [
    ...(activityAfterBaseline
      ? [
          `The latest bounded sample contains an event dated after the baseline retrieval at ${baseline.observedAt}.`,
        ]
      : []),
    ...(newExamples.length
      ? [
          `${newExamples.length} transaction hash${newExamples.length === 1 ? "" : "es"} appear in the latest retained examples but not the baseline examples.`,
        ]
      : []),
    ...(latest.stance === "limited-support" && stanceChanged
      ? [`The Hunter stance moved to limited-support under the same rule.`]
      : []),
  ];
  const newCounterevidence = [
    ...newLimits,
    ...newObservations,
    ...(!activityAfterBaseline
      ? [
          "No sampled event is dated after the baseline retrieval. This does not prove inactivity outside the bounded page.",
        ]
      : []),
    ...(latest.stance !== "limited-support"
      ? [latest.conclusion]
      : []),
  ];

  let headline: string;
  let finding: string;
  if (insufficient) {
    headline = "Latest retrieval is insufficient to revisit the conclusion.";
    finding =
      "The later source response completed but returned too little evidence. Keep the baseline conclusion as historical context; do not treat it as freshly confirmed.";
  } else if (stanceChanged) {
    headline = "The evidence and Hunter conclusion changed.";
    finding = `The same rule moved from ${baseline.stance} to ${latest.stance}. Inspect the newly retained evidence before changing any saved decision.`;
  } else if (meaningfulEvidenceChanged) {
    headline = "The evidence changed; the Hunter conclusion did not.";
    finding =
      "The latest bounded sample differs in event timing, retained transaction examples or source observations, but it still resolves to the same Hunter stance.";
  } else {
    headline = "No meaningful evidence change was found.";
    finding =
      "The latest retrieval completed, but no later-dated event, new retained transaction example, stance change or new report observation/limit was found. Retrieval time alone is not evidence of change.";
  }

  return {
    previousMissionId: previous.id,
    currentMissionId: current.id,
    previousReportHash: previous.reportHash,
    currentReportHash: current.reportHash,
    provider: current.provider,
    question: current.thesis,
    retrieval: {
      status: "completed",
      baselineAt: baseline.observedAt,
      latestAt: latest.observedAt,
      error: null,
    },
    coverage: {
      label: coverageLabel(current),
      baselineSource: baseline.source,
      latestSource: latest.source,
      baselineIndexedBlock: baseline.indexedBlock,
      latestIndexedBlock: latest.indexedBlock,
    },
    previousStance: baseline.stance,
    currentStance: latest.stance,
    stanceChanged,
    evidenceChange,
    conclusionImpact,
    headline,
    finding,
    previousConclusion: baseline.conclusion,
    currentConclusion: latest.conclusion,
    samples: { before: sample(baseline), after: sample(latest) },
    activityAfterBaseline,
    newExampleTransactions: newExamples,
    newSupportingEvidence,
    newCounterevidence,
    retainedCounterevidence: [...latest.limitations],
    nextAction: nextAction(current, newExamples),
    limitations: [...LIMITATIONS],
  };
}
