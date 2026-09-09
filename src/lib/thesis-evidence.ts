import { asCount } from "./analysis";
import { researchProject } from "./research-catalog";
import { queryGraphTransfers } from "./providers/graph-transfers";
import { inspectRepository } from "./providers/repository";
import type { MissionReport } from "./hunters";
import type { Thesis, ThesisMetric, ThesisSample } from "./thesis-types";

function graphSample(
  transfers: Array<{
    transaction: string;
    block: number;
    timestamp: string | null;
    logIndex: number | null;
  }>,
  indexedBlock: number,
  observedAt: string,
  sampleSize = transfers.length,
): ThesisSample {
  const latest = [...transfers]
    .filter(
      (event) =>
        event.logIndex !== null &&
        event.timestamp &&
        Number.isFinite(Date.parse(event.timestamp)),
    )
    .sort(
      (a, b) =>
        b.block - a.block || (b.logIndex ?? 0) - (a.logIndex ?? 0),
    )[0];
  if (!latest || latest.logIndex === null || !latest.timestamp)
    throw new Error(
      "The Graph returned no Transfer entity to pin as a revisit baseline.",
    );
  return {
    metric: "graph-transfer-event",
    observedAt,
    sourceUrl: `https://testnet.arcscan.app/tx/${latest.transaction}`,
    value: `${latest.transaction.toLowerCase()}:${latest.logIndex}`,
    sourceEventAt: latest.timestamp,
    provenance: {
      provider: "graph",
      schema: "Transfer",
      chainId: 5042002,
      indexedBlock,
      sampleSize: Math.min(sampleSize, 200),
      eventBlock: latest.block,
      eventTransaction: latest.transaction.toLowerCase(),
      eventLogIndex: latest.logIndex,
    },
  };
}

export function graphThesisBaselineFromReport(
  report: MissionReport,
): ThesisSample {
  if (
    report.provider !== "graph" ||
    report.indexedBlock === null ||
    !Number.isFinite(Date.parse(report.observedAt))
  )
    throw new Error("Choose a completed Graph report with an indexed block.");
  return graphSample(
    report.evidence,
    report.indexedBlock,
    report.observedAt,
    report.sampleSize,
  );
}

export async function readThesisEvidence(projectId: string, metric: ThesisMetric): Promise<ThesisSample> {
  const project = researchProject(projectId);
  if (!project) throw new Error("Unknown sourced project.");
  if (metric === "repository-head") {
    const report = await inspectRepository(projectId);
    const head = report.commits[0];
    if (!head) throw new Error("No repository head available.");
    return { metric, observedAt: report.observedAt, sourceUrl: head.url, value: head.hash, sourceEventAt: head.committedAt };
  }
  if (!project.contract) throw new Error("This metric needs a sourced token contract.");
  if (metric === "graph-transfer-event") {
    const result = await queryGraphTransfers(project.contract);
    return graphSample(
      result.transfers,
      result.indexedBlock,
      new Date().toISOString(),
    );
  }
  const sourceUrl = `https://testnet.arcscan.app/api/v2/${metric === "transaction-counter" ? "addresses" : "tokens"}/${project.contract}/counters`;
  const response = await fetch(sourceUrl, { redirect: "error", signal: AbortSignal.timeout(12000), cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Counter source unavailable.");
  const data = await response.json();
  const value = asCount(metric === "holder-counter" ? data.token_holders_count : metric === "transaction-counter" ? data.transactions_count : data.transfers_count);
  if (value === null) throw new Error("Source counter is unknown.");
  return { metric, observedAt: new Date().toISOString(), sourceUrl, value, sourceEventAt: null };
}
export function evaluateThesis(thesis: Thesis, sample: ThesisSample) {
  if (sample.metric !== thesis.metric) throw new Error("Evidence metric differs from the locked criterion.");
  if (Date.parse(sample.observedAt) < Date.parse(thesis.baseline.observedAt)) throw new Error("Observation predates the pinned baseline.");
  if (Date.parse(sample.observedAt) > Date.parse(thesis.deadline))
    return { met: false, observation: "This check is after the horizon. It cannot establish that the criterion was observed in time." };
  if (thesis.metric === "repository-head") {
    const met = sample.value !== thesis.baseline.value;
    return { met, observation: met ? "The observed default-branch head differs from the pinned baseline. This is not proof of deployment." : "The observed default-branch head is unchanged." };
  }
  if (thesis.metric === "graph-transfer-event") {
    const baseline = thesis.baseline.provenance;
    const current = sample.provenance;
    if (
      !baseline ||
      !current ||
      baseline.provider !== "graph" ||
      current.provider !== "graph" ||
      baseline.schema !== "Transfer" ||
      current.schema !== "Transfer" ||
      baseline.chainId !== 5042002 ||
      current.chainId !== 5042002
    )
      throw new Error(
        "Graph Transfer provenance is required for this locked criterion.",
      );
    const laterEvent =
      current.eventBlock > baseline.eventBlock ||
      (current.eventBlock === baseline.eventBlock &&
        current.eventLogIndex > baseline.eventLogIndex);
    return {
      met: laterEvent,
      observation: laterEvent
        ? `The Graph returned a later Transfer entity: block ${baseline.eventBlock}, log ${baseline.eventLogIndex} → block ${current.eventBlock}, log ${current.eventLogIndex}. Indexed block ${baseline.indexedBlock} → ${current.indexedBlock}.`
        : `The newest Graph Transfer entity is unchanged at block ${baseline.eventBlock}, log ${baseline.eventLogIndex}. Indexed block ${baseline.indexedBlock} → ${current.indexedBlock}; index progress alone does not meet the condition.`,
    };
  }
  if (typeof sample.value !== "number" || typeof thesis.baseline.value !== "number") throw new Error("Numeric counter required.");
  const delta = sample.value - thesis.baseline.value;
  return { met: delta >= thesis.threshold, observation: `${thesis.metric === "holder-counter" ? "Holder addresses" : thesis.metric === "transaction-counter" ? "Address transaction counter" : "Transfer counter"}: ${thesis.baseline.value.toLocaleString("en-US")} → ${sample.value.toLocaleString("en-US")} (${delta >= 0 ? "+" : ""}${delta}). Chosen threshold: +${thesis.threshold}. Counter changes are not active people or investment returns.` };
}
