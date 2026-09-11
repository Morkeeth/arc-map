import type { MissionReport } from "./hunters";
import { stableId } from "./stable-id";

/**
 * Inspectable next-step proposal after a supported Hunter result.
 * Local / fork simulation and review checklist only — never live funds or approvals.
 */

export type ActionProposalStep = {
  id: string;
  label: string;
  detail: string;
  href?: string;
};

export type ActionProposal = {
  id: string;
  status: "ready" | "withheld";
  title: string;
  summary: string;
  checklist: ActionProposalStep[];
  forbidden: string[];
  basedOn: {
    stance: MissionReport["stance"];
    target: string | null;
    sampleSize: number;
    transactions: number;
    firstEventAt: string | null;
    lastEventAt: string | null;
    provider: MissionReport["provider"];
    source: string;
    observedAt: string;
    limitations: string[];
  };
};

const FORBIDDEN = [
  "Do not send mainnet or testnet funds from this proposal.",
  "Do not treat limited-support as investment advice, airdrop eligibility or ownership proof.",
  "Do not approve wallet transactions solely because a Hunter returned support.",
  "Do not switch evidence providers silently if one fails.",
] as const;

export function actionProposalFor(
  report: MissionReport,
  address?: string,
): ActionProposal {
  if (report.stance !== "limited-support") {
    return {
      id: stableId(
        JSON.stringify([
          "withheld",
          report.stance,
          report.observedAt,
          report.thesis,
        ]),
      ),
      status: "withheld",
      title: "No action proposal",
      summary:
        report.stance === "not-supported"
          ? "The thesis was not supported by this sample. Do not prepare an action — widen evidence or pick another lead."
          : "Evidence was insufficient to assess the thesis. Do not invent a next step from an empty sample.",
      checklist: [],
      forbidden: [...FORBIDDEN],
      basedOn: base(report, address),
    };
  }

  const txs = [...new Set(report.evidence.map((e) => e.transaction))];
  const checklist: ActionProposalStep[] = [
    {
      id: "reopen-sample",
      label: "Re-open the retained sample",
      detail: `Confirm ${report.sampleSize} events across ${report.transactions} distinct transactions and the event window before acting on the conclusion.`,
    },
    {
      id: "inspect-txs",
      label: "Inspect sourced transactions on Arcscan",
      detail: "Open each retained hash. Look for mint/distribution patterns versus later independent calls. Hashes are evidence links, not a complete history.",
      href: txs[0]
        ? `https://testnet.arcscan.app/tx/${txs[0]}`
        : address
          ? `https://testnet.arcscan.app/address/${address}`
          : undefined,
    },
    {
      id: "local-fork-checklist",
      label: "Local / fork simulation checklist",
      detail:
        "If you simulate calls, do it on a local fork or read-only trace. Record the block you forked, the exact calldata, and whether the call reverts. Never broadcast from this desk.",
    },
    {
      id: "counterevidence-pass",
      label: "Run one counterevidence pass",
      detail:
        "Ask whether the second transaction could be the same operator, a test script or a distribution follow-up. Equal holder/transfer counters still do not prove unique people.",
    },
    {
      id: "track-or-compare",
      label: "Track a thesis or compare a later Hunt",
      detail:
        "Lock a measurable criterion with a finite schedule, or rerun the same Hunter later and compare reports. Do not edit this report in place.",
      href: "/theses",
    },
  ];

  for (const hash of txs.slice(0, 3)) {
    checklist.push({
      id: `tx-${hash.slice(0, 10)}`,
      label: `Review ${hash.slice(0, 10)}…`,
      detail: "Original transaction from the Hunter sample.",
      href: `https://testnet.arcscan.app/tx/${hash}`,
    });
  }

  return {
    id: stableId(
      JSON.stringify([
        "ready",
        report.stance,
        report.sampleSize,
        report.transactions,
        report.firstEventAt,
        report.lastEventAt,
        report.provider,
        txs,
      ]),
    ),
    status: "ready",
    title: "Reviewable action proposal",
    summary:
      `Hunter stance is limited-support for: “${report.thesis}”. Use this checklist for local inspection or fork simulation only — it is not a spend or approval path. ${report.conclusion}`,
    checklist,
    forbidden: [...FORBIDDEN],
    basedOn: base(report, address),
  };
}

function base(
  report: MissionReport,
  target?: string,
): ActionProposal["basedOn"] {
  return {
    stance: report.stance,
    target: target ?? null,
    sampleSize: report.sampleSize,
    transactions: report.transactions,
    firstEventAt: report.firstEventAt,
    lastEventAt: report.lastEventAt,
    provider: report.provider,
    source: report.source,
    observedAt: report.observedAt,
    limitations: [...report.limitations],
  };
}
