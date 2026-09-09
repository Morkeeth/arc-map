"use client";
import type { Mission } from "@/lib/hunters";
import { compareReports } from "@/lib/report-comparison";
import { retainedDecisionFor } from "@/lib/retained-decision";
export function ReportComparison({previous,current}:{previous:Mission;current:Mission}) {
  let comparison;
  try {comparison=compareReports(previous,current);} catch(e) {return <p className="setup-note">Comparison unavailable: {e instanceof Error?e.message:"Check report history."}</p>;}
  const previousDecision = retainedDecisionFor(previous);
  const currentDecision = retainedDecisionFor(current);
  return <section className="report-comparison"><span className="work-kicker">AGAINST THE PINNED REPORT</span>
    <h3>{comparison.stanceChanged?"The Hunter’s conclusion changed.":"The Hunter’s conclusion is unchanged."}</h3>
    <p>{comparison.finding}</p>
    <div className="comparison-pair"><div><span className="work-kicker">THEN · {new Date(comparison.baselineObservedAt).toLocaleString()}</span><p>{comparison.previousConclusion}</p><small>{comparison.samples.before.events} sampled events · {comparison.samples.before.transactions} transactions</small></div>
    <div><span className="work-kicker">NOW · {new Date(comparison.currentObservedAt).toLocaleString()}</span><p>{comparison.currentConclusion}</p><small>{comparison.samples.after.events} sampled events · {comparison.samples.after.transactions} transactions</small></div></div>
    <p className="report-time">Different sample windows are not a growth chart. {comparison.newExampleTransactions.length} transaction hashes differ among retained examples.</p>
    <div className="comparison-decisions">
      <strong>Retained decisions</strong>
      <p>
        Baseline: {previousDecision
          ? `${previousDecision.kind.replaceAll("-", " ")} · ${previousDecision.status} · ${previousDecision.id}`
          : "no review decision saved"}
      </p>
      <p>
        Later report: {currentDecision
          ? `${currentDecision.kind.replaceAll("-", " ")} · ${currentDecision.status} · ${currentDecision.id}`
          : "no review decision saved"}
      </p>
      <small>
        The rerun does not rewrite or carry forward the baseline decision.
      </small>
    </div>
    <details><summary>Comparison limits and commitments</summary>{comparison.limitations.map(l=><p className="report-time" key={l}>{l}</p>)}<code className="report-hash">Before {comparison.previousReportHash}</code><code className="report-hash">After {comparison.currentReportHash}</code></details>
  </section>;
}
