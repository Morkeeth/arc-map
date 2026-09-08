"use client";
import { useState } from "react";
import type { MissionReport } from "@/lib/hunters";
import {
  LOCAL_OPPORTUNITY_CHAIN_ID,
  OPPORTUNITY_EVIDENCE_MAX_AGE_SECONDS,
  opportunityFixtureAddress,
  type StoredOpportunityReceipt,
} from "@/lib/opportunity-action";
import { useHunterWallet } from "./wallet-provider";

type Control = "wrong-account" | "stale-evidence" | "changed-calldata";

export function OpportunityRehearsal({
  missionId,
  target,
  report,
  savedReceipt,
}: {
  missionId: string;
  target: string;
  report: MissionReport;
  savedReceipt?: StoredOpportunityReceipt | null;
}) {
  const wallet = useHunterWallet();
  const [receipt, setReceipt] = useState(savedReceipt ?? null);
  const [refusal, setRefusal] = useState<{
    control: Control;
    reason: string;
    simulationRpcStarted: false;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const preview = process.env.NEXT_PUBLIC_RESEARCH_PREVIEW === "1";
  const sourceBlock =
    report.indexedBlock ??
    Math.max(0, ...report.evidence.map((item) => item.block));
  const freshnessSeconds = Math.floor(
    (Date.now() - Date.parse(report.observedAt)) / 1_000,
  );

  if (preview)
    return (
      <section className="opportunity-rehearsal preview-boundary">
        <strong>Public preview stays wallet-free.</strong>
        <p>
          The account-bound chain-ID-31337 rehearsal is unavailable here. This
          research preview cannot sign, broadcast or enable transaction
          execution.
        </p>
      </section>
    );

  async function run(control?: Control) {
    const account = wallet.address ?? (control ? receipt?.account : null);
    if (!account) return;
    setBusy(control ?? "positive");
    setError("");
    if (!control) setRefusal(null);
    try {
      const response = await fetch(`/api/missions/${missionId}/opportunity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, control }),
      });
      const result = await response.json();
      if (result.refusal) {
        setRefusal(result.refusal);
        return;
      }
      if (!response.ok)
        throw new Error(result.error || "Local fixture rehearsal failed.");
      setReceipt(result.receipt);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Local fixture rehearsal failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="opportunity-rehearsal" aria-label="Opportunity rehearsal">
      <div className="list-caption">
        <span>ACCOUNT-BOUND OPPORTUNITY REHEARSAL</span>
        <span>LOCAL FIXTURE · CHAIN {LOCAL_OPPORTUNITY_CHAIN_ID}</span>
      </div>
      <h3>Inspect, simulate, retain.</h3>
      <p className="policy-intro">
        This uses the selected Privy-connected address as a read-only simulated
        sender. It never requests a signature and never broadcasts. Chain
        31337 is isolated Anvil—not Arc public-chain, Arc testnet or mainnet
        proof.
      </p>
      {!wallet.address ? (
        <button
          className="work-primary-button"
          disabled={!wallet.ready}
          onClick={wallet.connect}
        >
          {wallet.ready ? "Connect external or embedded wallet" : "Loading wallet…"}
        </button>
      ) : (
        <label className="opportunity-wallet-select">
          <span>Connected account used for simulation</span>
          <select
            value={wallet.address}
            onChange={(event) => wallet.select(event.target.value)}
          >
            {wallet.wallets.map((item) => (
              <option value={item.address} key={item.address}>
                {item.kind} · {item.address}
              </option>
            ))}
          </select>
        </label>
      )}
      <dl className="opportunity-binding">
        <div><dt>Target</dt><dd>{target}</dd></div>
        <div><dt>Fixture asset</dt><dd>{opportunityFixtureAddress("opportunity-token")}</dd></div>
        <div><dt>Amount / ceiling</dt><dd>25,000 / 30,000 fixture units</dd></div>
        <div><dt>Policy</dt><dd>Exact account, target, asset, calldata and fresh evidence; expires 10 minutes after server preparation</dd></div>
        <div><dt>Evidence</dt><dd>{report.provider === "graph" ? "The Graph" : "Arcscan"} · source block {sourceBlock} · retrieved {report.observedAt}</dd></div>
        <div><dt>Freshness</dt><dd className={freshnessSeconds > OPPORTUNITY_EVIDENCE_MAX_AGE_SECONDS ? "refusal-text" : ""}>{Math.max(0, freshnessSeconds)}s old · maximum {OPPORTUNITY_EVIDENCE_MAX_AGE_SECONDS}s</dd></div>
        <div><dt>Counterevidence</dt><dd>{report.limitations[0] ?? "Unavailable"}</dd></div>
      </dl>
      <div className="opportunity-actions">
        <button
          className="work-primary-button"
          disabled={!wallet.address || Boolean(busy)}
          onClick={() => void run()}
        >
          {busy === "positive" ? "Simulating local fixture…" : "Rehearse and retain receipt"}
        </button>
      </div>
      <details className="opportunity-controls">
        <summary>Run visible refusal controls</summary>
        <p className="policy-intro">
          Each control must stop before simulation RPC. A reopened receipt can
          rerun these checks against its retained account without reconnecting.
        </p>
        <div>
          {(
            [
              ["wrong-account", "Wrong account"],
              ["stale-evidence", "Stale evidence"],
              ["changed-calldata", "Changed calldata"],
            ] as const
          ).map(([control, label]) => (
            <button
              key={control}
              disabled={(!wallet.address && !receipt) || Boolean(busy)}
              onClick={() => void run(control)}
            >
              {busy === control ? "Checking…" : label}
            </button>
          ))}
        </div>
      </details>
      {error && <p className="work-error" role="alert">{error}</p>}
      {refusal && (
        <p className="opportunity-refusal" role="alert">
          <strong>REFUSED · {refusal.control.replaceAll("-", " ")}</strong>
          {refusal.reason} Simulation RPC started: no.
        </p>
      )}
      {receipt && <OpportunityReceipt receipt={receipt} />}
    </section>
  );
}

function OpportunityReceipt({
  receipt,
}: {
  receipt: StoredOpportunityReceipt;
}) {
  return (
    <details className="opportunity-receipt" open>
      <summary>Retained local simulation receipt {receipt.id}</summary>
      <p className="policy-pass">
        <strong>Decoded fixture effects</strong>
        {receipt.deltas.map((delta) => (
          <span key={delta.account}>
            {delta.account}: {delta.before} → {delta.after} ({delta.delta})
          </span>
        ))}
      </p>
      <dl className="opportunity-binding">
        <div><dt>Account</dt><dd>{receipt.account}</dd></div>
        <div><dt>Target / asset</dt><dd>{receipt.approvedTarget} / {receipt.asset}</dd></div>
        <div><dt>Amount / ceiling</dt><dd>{receipt.amount} / {receipt.amountCeiling}</dd></div>
        <div><dt>Policy expiry</dt><dd>{new Date(receipt.policyExpiresAt * 1_000).toISOString()}</dd></div>
        <div><dt>Source / block</dt><dd>{receipt.evidence.provider} · {receipt.evidence.source} · {receipt.evidence.sourceBlock}</dd></div>
        <div><dt>Evidence freshness</dt><dd>{receipt.evidence.freshnessSeconds}s / {receipt.evidence.maximumFreshnessSeconds}s maximum</dd></div>
        <div><dt>Fixture block</dt><dd>chain {receipt.pin.chainId} · block {receipt.pin.blockNumber} · {receipt.pin.blockHash}</dd></div>
        <div><dt>Calldata</dt><dd><code>{receipt.calldata}</code></dd></div>
        <div><dt>Binding hash</dt><dd><code>{receipt.bindingHash}</code></dd></div>
      </dl>
      {receipt.limitations.map((limit) => (
        <p className="report-time" key={limit}>{limit}</p>
      ))}
    </details>
  );
}
