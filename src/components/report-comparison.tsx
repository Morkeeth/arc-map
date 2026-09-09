"use client";
import type { Mission } from "@/lib/hunters";
import { compareReports } from "@/lib/report-comparison";
import { retainedDecisionFor } from "@/lib/retained-decision";

const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "not returned";

export function ReportComparison({
  previous,
  current,
}: {
  previous: Mission;
  current: Mission;
}) {
  let comparison;
  try {
    comparison = compareReports(previous, current);
  } catch (error) {
    return (
      <p className="setup-note">
        Comparison unavailable:{" "}
        {error instanceof Error ? error.message : "Check report history."}
      </p>
    );
  }
  const previousDecision = retainedDecisionFor(previous);
  const currentDecision = retainedDecisionFor(current);
  return (
    <section className="report-comparison" aria-label="Revisit comparison">
      <div className="comparison-heading">
        <div>
          <span className="work-kicker">AGAINST THE PINNED REPORT</span>
          <h3>{comparison.headline}</h3>
        </div>
        <span className={`comparison-outcome ${comparison.conclusionImpact}`}>
          conclusion {comparison.conclusionImpact}
        </span>
      </div>
      <p>{comparison.finding}</p>

      <section className={`retrieval-outcome ${comparison.retrieval.status}`}>
        <div className="list-caption">
          <span>LATEST RETRIEVAL</span>
          <span>{comparison.retrieval.status}</span>
        </div>
        <p>
          <strong>{comparison.provider === "graph" ? "The Graph" : "Arcscan explorer"}</strong>
          {" · "}
          baseline retrieved {date(comparison.retrieval.baselineAt)}
          {" · "}
          latest retrieved {date(comparison.retrieval.latestAt)}
        </p>
        {comparison.retrieval.error && (
          <p className="retrieval-error">{comparison.retrieval.error}</p>
        )}
        <p className="report-time">{comparison.coverage.label}</p>
        <p className="report-time">
          Baseline source: {comparison.coverage.baselineSource}
          {comparison.coverage.baselineIndexedBlock !== null
            ? ` · indexed block ${comparison.coverage.baselineIndexedBlock}`
            : ""}
          <br />
          Latest source: {comparison.coverage.latestSource ?? "not returned"}
          {comparison.coverage.latestIndexedBlock !== null
            ? ` · indexed block ${comparison.coverage.latestIndexedBlock}`
            : ""}
        </p>
      </section>

      <div className="comparison-pair">
        <div>
          <span className="work-kicker">
            BASELINE · {date(comparison.retrieval.baselineAt)}
          </span>
          <p>{comparison.previousConclusion}</p>
          <small>
            {comparison.samples.before.events} sampled events ·{" "}
            {comparison.samples.before.transactions} transactions
          </small>
        </div>
        <div>
          <span className="work-kicker">
            LATEST · {date(comparison.retrieval.latestAt)}
          </span>
          <p>
            {comparison.currentConclusion ??
              "No later conclusion: retrieval did not return a report."}
          </p>
          <small>
            {comparison.samples.after
              ? `${comparison.samples.after.events} sampled events · ${comparison.samples.after.transactions} transactions`
              : "No latest sample"}
          </small>
        </div>
      </div>

      <div className="comparison-evidence">
        <section>
          <span className="work-kicker">NEW SUPPORTING EVIDENCE</span>
          {comparison.newSupportingEvidence.length ? (
            <ul>
              {comparison.newSupportingEvidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>
              None identified in the latest bounded sample. A later retrieval
              timestamp alone is not evidence.
            </p>
          )}
        </section>
        <section>
          <span className="work-kicker">NEW COUNTEREVIDENCE / LIMITS</span>
          <ul>
            {comparison.newCounterevidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <details>
            <summary>Limits that still apply</summary>
            {comparison.retainedCounterevidence.map((item) => (
              <p className="report-time" key={item}>
                {item}
              </p>
            ))}
          </details>
        </section>
      </div>

      <section className="comparison-next">
        <span className="work-kicker">INSPECT NEXT</span>
        <h4>{comparison.nextAction.label}</h4>
        <p>{comparison.nextAction.detail}</p>
        <a
          className="evidence-link"
          href={comparison.nextAction.href}
          target={
            comparison.nextAction.href.startsWith("/") ? undefined : "_blank"
          }
          rel={
            comparison.nextAction.href.startsWith("/")
              ? undefined
              : "noreferrer"
          }
        >
          Open next evidence →
        </a>
      </section>

      <div className="comparison-decisions">
        <strong>Retained decisions</strong>
        <p>
          Baseline:{" "}
          {previousDecision
            ? `${previousDecision.kind.replaceAll("-", " ")} · ${previousDecision.status} · ${previousDecision.id}`
            : "no review decision saved"}
        </p>
        <p>
          Latest:{" "}
          {currentDecision
            ? `${currentDecision.kind.replaceAll("-", " ")} · ${currentDecision.status} · ${currentDecision.id}`
            : "no review decision saved"}
        </p>
        <small>
          The revisit never rewrites or carries forward the baseline decision.
        </small>
      </div>
      <details>
        <summary>Comparison limits and immutable commitments</summary>
        {comparison.limitations.map((limitation) => (
          <p className="report-time" key={limitation}>
            {limitation}
          </p>
        ))}
        <code className="report-hash">
          Before {comparison.previousReportHash}
        </code>
        <code className="report-hash">
          After {comparison.currentReportHash ?? "No latest report commitment"}
        </code>
      </details>
    </section>
  );
}
