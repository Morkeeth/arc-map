"use client";
import type { ActionProposal } from "@/lib/action-proposal";

export function ActionProposalPanel({
  proposal,
}: {
  proposal: ActionProposal;
}) {
  if (proposal.status === "withheld") {
    return (
      <section className="action-proposal withheld" aria-label="Action proposal">
        <div className="list-caption">
          <span>ACTION PROPOSAL</span>
          <span>withheld</span>
        </div>
        <h3>{proposal.title}</h3>
        <p>{proposal.summary}</p>
        <p className="report-time">
          Stance {proposal.basedOn.stance} · sample {proposal.basedOn.sampleSize} ·{" "}
          {proposal.basedOn.transactions} distinct tx · provider{" "}
          {proposal.basedOn.provider}
        </p>
      </section>
    );
  }

  return (
    <section className="action-proposal" aria-label="Action proposal">
      <div className="list-caption">
        <span>ACTION PROPOSAL</span>
        <span>local / fork review only</span>
      </div>
      <h3>{proposal.title}</h3>
      <p>{proposal.summary}</p>
      <p className="report-time">
        Based on {proposal.basedOn.sampleSize} sampled events ·{" "}
        {proposal.basedOn.transactions} transactions · observed{" "}
        {new Date(proposal.basedOn.observedAt).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {proposal.basedOn.firstEventAt
          ? ` · events ${new Date(proposal.basedOn.firstEventAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
          : ""}
        {proposal.basedOn.lastEventAt &&
        proposal.basedOn.lastEventAt !== proposal.basedOn.firstEventAt
          ? ` → ${new Date(proposal.basedOn.lastEventAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
          : ""}
        . Proposal id {proposal.id}.
      </p>
      <ol className="action-checklist">
        {proposal.checklist.map((step) => (
          <li key={step.id}>
            <strong>{step.label}</strong>
            <p>{step.detail}</p>
            {step.href && (
              <a className="evidence-link" href={step.href} target={step.href.startsWith("/") ? undefined : "_blank"} rel={step.href.startsWith("/") ? undefined : "noreferrer"}>
                Open →
              </a>
            )}
          </li>
        ))}
      </ol>
      <details>
        <summary>What this proposal forbids</summary>
        {proposal.forbidden.map((line) => (
          <p className="report-time" key={line}>
            {line}
          </p>
        ))}
      </details>
    </section>
  );
}
