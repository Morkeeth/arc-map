"use client";
import { useState, type FormEvent } from "react";
import type { ActionProposal } from "@/lib/action-proposal";
import type { MissionReport } from "@/lib/hunters";
import {
  evidenceWithholdReceipt,
  initialPolicyEnvelope,
  type PolicyEnvelope,
  type PolicyField,
  type PolicyReceipt,
  type PolicyReview,
} from "@/lib/policy-envelope";
import { OpportunityRehearsal } from "./opportunity-rehearsal";

export function ActionProposalPanel({
  proposal,
  missionId,
  savedReview,
  report,
  savedOpportunityReceipt,
}: {
  proposal: ActionProposal;
  missionId: string;
  savedReview?: PolicyReview | null;
  report: MissionReport;
  savedOpportunityReceipt?: import("@/lib/opportunity-action").StoredOpportunityReceipt | null;
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

  return (
    <ReadyActionProposal
      proposal={proposal}
      missionId={missionId}
      savedReview={savedReview}
      report={report}
      savedOpportunityReceipt={savedOpportunityReceipt}
    />
  );
}

function ReadyActionProposal({
  proposal,
  missionId,
  savedReview,
  report,
  savedOpportunityReceipt,
}: {
  proposal: ActionProposal;
  missionId: string;
  savedReview?: PolicyReview | null;
  report: MissionReport;
  savedOpportunityReceipt?: import("@/lib/opportunity-action").StoredOpportunityReceipt | null;
}) {
  const [envelope, setEnvelope] = useState<PolicyEnvelope>(() =>
    savedReview?.envelope ?? initialPolicyEnvelope(proposal),
  );
  const [proposedAmount, setProposedAmount] = useState(
    savedReview?.proposedAmount ?? "0.01",
  );
  const [receipt, setReceipt] = useState<PolicyReceipt | null>(
    savedReview?.receipt ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const stoppedField = receipt?.stopReason?.field ?? null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch(`/api/missions/${missionId}/policy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envelope, proposedAmount }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Policy review could not be saved.");
      const review = result.policyReview as PolicyReview;
      setEnvelope(review.envelope);
      setProposedAmount(review.proposedAmount);
      setReceipt(review.receipt);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Policy review could not be saved.",
      );
    } finally {
      setSaving(false);
    }
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
          <span>editable · private workspace</span>
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
            label="Expiry · UTC"
            stoppedField={stoppedField}
          >
            <input
              aria-invalid={stoppedField === "expiry"}
              type="datetime-local"
              value={envelope.expiresAt.slice(0, 16)}
              onChange={(event) =>
                setEnvelope({
                  ...envelope,
                  expiresAt: event.target.value
                    ? `${event.target.value}:00.000Z`
                    : "",
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
          <button
            className="work-primary-button"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving simulation…" : "Simulate and save receipt"}
          </button>
        </div>
        {saveError && <p className="work-error">{saveError}</p>}
      </form>
      {receipt && (
        <>
          <p className="decision-retained" role="status">
            Decision retained in this private workspace. Reopen this Hunt to
            inspect the same receipt; a rerun creates a separate report.
          </p>
          <PolicyReceiptView receipt={receipt} />
        </>
      )}
      <OpportunityRehearsal
        missionId={missionId}
        target={proposal.basedOn.target ?? ""}
        report={report}
        savedReceipt={savedOpportunityReceipt}
      />
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
