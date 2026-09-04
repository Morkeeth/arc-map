import { summarizeTransfers } from "./analysis";
import { scoutToken } from "./providers/explorer";
import { queryGraphTransfers } from "./providers/graph-transfers";
import type { Mission, MissionReport } from "./hunters";
import type { HuntReport } from "./types";

export function buildMissionReport(
  mission: Mission,
  scout: HuntReport,
  indexedBlock: number | null,
): MissionReport {
  const stance =
    scout.examined === 0
      ? "insufficient-evidence"
      : scout.uniqueTransactions > 1
        ? "limited-support"
        : "not-supported";
  return {
    version: 1,
    hunter: mission.hunterId,
    thesis: mission.thesis,
    stance,
    provider: mission.provider,
    source:
      mission.provider === "graph"
        ? "The Graph / configured ARC MAP transfer subgraph"
        : scout.source,
    observedAt: scout.fetchedAt,
    indexedBlock,
    sampleSize: scout.examined,
    transactions: scout.uniqueTransactions,
    firstEventAt: scout.oldestTransferAt,
    lastEventAt: scout.newestTransferAt,
    evidence: scout.evidence,
    conclusion:
      stance === "insufficient-evidence"
        ? "The source returned no events. The thesis cannot be assessed."
        : stance === "limited-support"
          ? "The sample contains more than one transaction. This supports activity beyond a single transaction, not sustained adoption or independent ownership."
          : "The sampled transfers all belong to one transaction. This sample does not demonstrate activity beyond that transaction.",
    observations: scout.observations,
    limitations: [
      "This is a bounded transfer sample, not a complete history or a measure of unique people.",
      "The report retains up to eight example transfer records; its aggregate counts cover the full returned sample.",
      "Contracts, token names and transfer counts do not establish project legitimacy, intent or investment value.",
      "Rules-based analysis, not an autonomous investment decision. No trade was executed.",
      ...(scout.moreAvailable
        ? ["More events exist outside this sample."]
        : []),
      ...(mission.provider === "graph"
        ? [
            "Indexed data can lag chain state. Fresh RPC checks are required before financial actions.",
          ]
        : ["Explorer research does not satisfy a live Graph integration."]),
    ],
    steps: [
      {
        tool:
          mission.provider === "graph"
            ? "query_transfer_subgraph"
            : "inspect_explorer_sample",
        result: `${scout.examined} events; ${scout.uniqueTransactions} distinct transactions`,
      },
      { tool: "test_distribution_thesis", result: stance },
      {
        tool: "commit_report",
        result: "Content hash generated; not yet an onchain receipt.",
      },
    ],
  };
}
export async function runHunter(mission: Mission): Promise<MissionReport> {
  if (mission.provider === "explorer")
    return buildMissionReport(mission, await scoutToken(mission.address), null);
  const data = await queryGraphTransfers(mission.address);
  const scout = summarizeTransfers({
    address: mission.address,
    transfers: data.transfers,
    holderCount: null,
    transferCount: null,
    moreAvailable: data.moreAvailable,
    fetchedAt: new Date().toISOString(),
  });
  return buildMissionReport(mission, scout, data.indexedBlock);
}
