"use client";
import { useState } from "react";
import { Code2, ArrowUpRight } from "lucide-react";
import type { RepositoryReport } from "@/lib/providers/repository";
import type { ShipInvestigation } from "@/lib/ship-store";

export function RepositoryPanel({ projectId }: { projectId: string }) {
  const [report, setReport] = useState<RepositoryReport | null>(null);
  const [investigation, setInvestigation] = useState<ShipInvestigation | null>(null);
  const [claim, setClaim] = useState(
    projectId === "arc-node"
      ? "arc-node published v0.8.0 with linux binaries"
      : "Agent Stack shipped v1.0.0 with starter-kit binaries",
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function inspectCommits() {
    setBusy("commits");
    setError("");
    try {
      const response = await fetch(`/api/repository/${encodeURIComponent(projectId)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setReport(result.report);
    } catch {
      setError("Repository commit evidence unavailable. No deployment claim inferred.");
    } finally {
      setBusy("");
    }
  }

  async function investigateReleases() {
    setBusy("releases");
    setError("");
    try {
      const response = await fetch("/api/ship-investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, claim }),
      });
      const result = await response.json();
      if (!response.ok && !result.investigation)
        throw new Error(result.error || "Investigation failed.");
      setInvestigation(result.investigation);
      if (result.investigation?.status === "blocked")
        setError(result.investigation.error || "Release observation blocked.");
    } catch {
      setError("Release evidence unavailable. No shipping claim inferred.");
    } finally {
      setBusy("");
    }
  }

  async function rerun() {
    if (!investigation) return;
    setBusy("rerun");
    setError("");
    try {
      const response = await fetch(
        `/api/ship-investigations/${encodeURIComponent(investigation.id)}/observe`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok && !result.investigation)
        throw new Error(result.error || "Rerun failed.");
      setInvestigation(result.investigation);
    } catch {
      setError("Rerun failed. Pinned evidence is retained when already observed.");
    } finally {
      setBusy("");
    }
  }

  const ship = investigation?.report;

  return (
    <section className="mission-composer">
      <span className="work-kicker">
        <Code2 size={13} />
        SHIP HUNTER
      </span>
      <h3>What did the source actually ship?</h3>
      <p className="report-time">
        Releases are the object. Commits are a different claim. Neither is a network
        upgrade.
      </p>
      <label className="thesis-form">
        Shipping claim
        <textarea
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          minLength={8}
          maxLength={400}
          rows={2}
          required
        />
      </label>
      <div className="work-actions" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          className="work-primary-button"
          onClick={() => void investigateReleases()}
          disabled={Boolean(busy) || claim.trim().length < 8}
        >
          {busy === "releases" ? "Reading releases…" : "Investigate releases"}
        </button>
        <button
          className="work-refresh work-text-button"
          onClick={() => void inspectCommits()}
          disabled={Boolean(busy)}
        >
          {busy === "commits" ? "Reading commits…" : "Inspect commits"}
        </button>
        {investigation?.status === "observed" && (
          <button
            className="work-refresh work-text-button"
            onClick={() => void rerun()}
            disabled={Boolean(busy)}
          >
            {busy === "rerun" ? "Comparing…" : "Re-observe and compare"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="setup-note">
          {error}
        </p>
      )}
      {ship && investigation && (
        <div className="repository-report">
          <p>
            <strong>{ship.evidence.stance.replaceAll("-", " ").toUpperCase()}</strong>
            {" · "}
            {ship.evidence.conclusion}
          </p>
          <p className="report-time">
            Naive latest-tag arm: {ship.naive.stance.replaceAll("-", " ")}.{" "}
            {ship.disagreement
              ? "Arms disagree — evidence arm wins when naive over-claims."
              : "Arms agree on stance."}{" "}
            Sample {ship.sampleSize} release(s). Tokens:{" "}
            {ship.tokens.join(", ") || "(none)"}.
          </p>
          {investigation.observation?.releases.slice(0, 5).map((release) => (
            <a
              className="evidence-link"
              href={release.htmlUrl}
              key={release.id}
              target="_blank"
              rel="noreferrer"
            >
              {release.tag}
              {release.draft ? " · draft" : ""}
              {release.prerelease ? " · prerelease" : ""}
              {release.binaryAssets
                ? ` · ${release.binaryAssets} binaries`
                : " · no binaries"}
              <ArrowUpRight size={12} />
            </a>
          ))}
          {investigation.reruns?.length > 0 && (
            <small>
              {investigation.reruns.length} rerun(s). Latest{" "}
              {investigation.reruns.at(-1)?.changedFromPinned
                ? "differs from pinned observation"
                : "matches pinned observation"}
              .
            </small>
          )}
          <small>
            Observed {new Date(ship.observedAt).toLocaleString()}. Claim and pinned
            observation stay immutable.
          </small>
        </div>
      )}
      {report?.projectId === projectId && (
        <div className="repository-report">
          <p>{report.conclusion}</p>
          {report.commits.slice(0, 5).map((commit) => (
            <a
              className="evidence-link"
              href={commit.url}
              key={commit.hash}
              target="_blank"
              rel="noreferrer"
            >
              {commit.title}
              <ArrowUpRight size={12} />
            </a>
          ))}
          <small>
            Commit sample observed {new Date(report.observedAt).toLocaleString()}. At
            most ten default-branch commits, not releases.
          </small>
        </div>
      )}
    </section>
  );
}
