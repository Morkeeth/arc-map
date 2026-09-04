import { asCount } from "./analysis";
import { researchProject } from "./research-catalog";
import { inspectRepository } from "./providers/repository";
import type { Thesis, ThesisMetric, ThesisSample } from "./thesis-types";
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
  if (typeof sample.value !== "number" || typeof thesis.baseline.value !== "number") throw new Error("Numeric counter required.");
  const delta = sample.value - thesis.baseline.value;
  return { met: delta >= thesis.threshold, observation: `${thesis.metric === "holder-counter" ? "Holder addresses" : thesis.metric === "transaction-counter" ? "Address transaction counter" : "Transfer counter"}: ${thesis.baseline.value.toLocaleString("en-US")} → ${sample.value.toLocaleString("en-US")} (${delta >= 0 ? "+" : ""}${delta}). Chosen threshold: +${thesis.threshold}. Counter changes are not active people or investment returns.` };
}
