"use client";
import { useState, type FormEvent } from "react";
import type { ActionProposal } from "@/lib/action-proposal";
import {
  evidenceWithholdReceipt,
  evaluatePolicyEnvelope,
  initialPolicyEnvelope,
  type PolicyEnvelope,
  type PolicyField,
  type PolicyReceipt,
} from "@/lib/policy-envelope";

export function ActionProposalPanel({
  proposal,
}: {
  proposal: ActionProposal;
}) {
  if (proposal.status === "withheld") {
    const receipt = evidenceWithholdReceipt(
      proposal,
      proposal.basedOn.observedAt,
    );
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
        <PolicyReceiptView receipt={receipt} />
      </section>
    );
  }

  return <ReadyActionProposal proposal={proposal} />;
}

function ReadyActionProposal({ proposal }: { proposal: ActionProposal }) {
  const [envelope, setEnvelope] = useState<PolicyEnvelope>(() =>
    initialPolicyEnvelope(proposal),
  );
  const [proposedAmount, setProposedAmount] = useState("0.01");
  const [receipt, setReceipt] = useState<PolicyReceipt | null>(null);
  const stoppedField = receipt?.stopReason?.field ?? null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReceipt(
      evaluatePolicyEnvelope({
        proposal,
        envelope,
        proposedAmount,
        now: new Date().toISOString(),
      }),
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
      <form className="policy-envelope" onSubmit={submit} noValidate>
        <div className="list-caption">
          <span>POLICY ENVELOPE</span>
          <span>editable · local simulation</span>
        </div>
        <p className="policy-intro">
          Attach constraints to this supported result, then evaluate one
          review-only action. Changing a bound can withhold the action; nothing
          is signed or broadcast.
        </p>
        <div className="policy-grid">
          <PolicyInput
            field="ceiling"
            label="Amount ceiling"
            stoppedField={stoppedField}
          >
            <input
              aria-invalid={stoppedField === "ceiling"}
              inputMode="decimal"
              value={envelope.ceiling}
              onChange={(event) =>
                setEnvelope({ ...envelope, ceiling: event.target.value })
              }
            />
          </PolicyInput>
          <PolicyInput
            field="asset"
            label="Approved asset"
            stoppedField={stoppedField}
          >
            <input
              aria-invalid={stoppedField === "asset"}
              value={envelope.approvedAsset}
              onChange={(event) =>
                setEnvelope({
                  ...envelope,
                  approvedAsset: event.target.value,
                })
              }
            />
          </PolicyInput>
          <PolicyInput
            field="target"
            label="Approved target"
            stoppedField={stoppedField}
          >
            <input
              aria-invalid={stoppedField === "target"}
              value={envelope.approvedTarget}
              onChange={(event) =>
                setEnvelope({
                  ...envelope,
                  approvedTarget: event.target.value,
                })
              }
            />
          </PolicyInput>
          <PolicyInput
            field="evidenceThreshold"
            label="Evidence threshold · distinct tx"
            stoppedField={stoppedField}
          >
            <input
              aria-invalid={stoppedField === "evidenceThreshold"}
              inputMode="numeric"
              type="number"
              min="1"
              step="1"
              value={envelope.evidenceThreshold}
              onChange={(event) =>
                setEnvelope({
                  ...envelope,
                  evidenceThreshold: Number(event.target.value),
                })
              }
            />
          </PolicyInput>
          <PolicyInput
            field="expiry"
            label="Expiry · your local time"
            stoppedField={stoppedField}
          >
            <input
              aria-invalid={stoppedField === "expiry"}
              type="datetime-local"
              value={envelope.expiresAt.slice(0, 16)}
              onChange={(event) =>
                setEnvelope({
                  ...envelope,
                  expiresAt: event.target.value,
                })
              }
            />
          </PolicyInput>
          <PolicyInput
            field="counterevidence"
            label="Counterevidence reference"
            stoppedField={stoppedField}
          >
            <textarea
              aria-invalid={stoppedField === "counterevidence"}
              value={envelope.counterevidenceRef}
              onChange={(event) =>
                setEnvelope({
                  ...envelope,
                  counterevidenceRef: event.target.value,
                })
              }
            />
          </PolicyInput>
        </div>
        <div className="policy-action-row">
          <label>
            <span>Proposed simulated amount</span>
            <input
              aria-invalid={stoppedField === "ceiling"}
              inputMode="decimal"
              value={proposedAmount}
              onChange={(event) => setProposedAmount(event.target.value)}
            />
          </label>
          <button className="work-primary-button" type="submit">
            Simulate policy-gated action
          </button>
        </div>
      </form>
      {receipt && <PolicyReceiptView receipt={receipt} />}
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

function PolicyInput({
  field,
  label,
  stoppedField,
  children,
}: {
  field: PolicyField;
  label: string;
  stoppedField: PolicyField | null;
  children: React.ReactNode;
}) {
  return (
    <label className={stoppedField === field ? "policy-field failed" : "policy-field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function PolicyReceiptView({ receipt }: { receipt: PolicyReceipt }) {
  return (
    <section
      className={`policy-receipt ${receipt.status}`}
      aria-label="Policy simulation receipt"
      aria-live="polite"
    >
      <div className="list-caption">
        <span>SIMULATION RECEIPT {receipt.id}</span>
        <span>{receipt.status}</span>
      </div>
      {receipt.stopReason ? (
        <p className="policy-stop">
          <strong>Stop field: {receipt.stopReason.field}</strong>
          {receipt.stopReason.message}
        </p>
      ) : (
        <p className="policy-pass">
          <strong>Envelope passed.</strong>
          Reviewable action: {receipt.action?.amount}{" "}
          {receipt.action?.asset} toward {receipt.action?.target}. No execution
          occurred.
        </p>
      )}
      <dl className="policy-receipt-facts">
        <div>
          <dt>Evidence</dt>
          <dd>
            {receipt.evidence.stance} ·{" "}
            {receipt.evidence.observedTransactions} distinct tx
          </dd>
        </div>
        <div>
          <dt>Expiry</dt>
          <dd>{receipt.envelope?.expiresAt ?? "No envelope attached"}</dd>
        </div>
        <div>
          <dt>Counterevidence</dt>
          <dd>
            {receipt.envelope?.counterevidenceRef ??
              "Unavailable: evidence gate stopped first"}
          </dd>
        </div>
      </dl>
      <p className="report-time">{receipt.limit}</p>
    </section>
  );
}
