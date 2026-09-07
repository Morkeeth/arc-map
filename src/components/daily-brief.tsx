"use client";
import Link from "next/link";
import { useState } from "react";
import type { DailyBrief as BriefData } from "@/lib/daily-brief";
import type { ResearchUpdate } from "@/lib/research-updates";
import type { Project } from "@/lib/projects";
import type { LastHuntReturn } from "@/lib/last-hunt-return";
import { selectFollowedBrief } from "@/lib/brief-selection";

const time = (at: string) =>
  new Date(at).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

type WorkerData = {
  name: string;
  lastSuccess: string | null;
  lastError: string | null;
  cycles: number;
  freshness: "running" | "stale" | "failed" | "stopped" | "missing";
  summary?: string;
};

const workerTime = (at: string | null) =>
  at
    ? new Date(at).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "no completed cycle";

function workerSummary(workers: WorkerData[] | null) {
  if (workers === null) return "Status unavailable";
  if (!workers.length || workers.some((w) => w.freshness === "missing"))
    return "Missing expected workers";
  if (workers.every((w) => w.freshness === "running"))
    return "All source cycles live";
  return "Inspect freshness";
}

export function DailyBrief({
  data,
  updates,
  workers,
  following,
  lastHunt,
  onSelect,
  onReview,
  error,
}: {
  data: BriefData | null;
  updates: ResearchUpdate[] | null;
  workers: WorkerData[] | null;
  following: string[];
  lastHunt: LastHuntReturn | null;
  onSelect: (p: Project) => void;
  onReview: (id: string) => Promise<void>;
  error: string | null;
}) {
  const [filter, setFilter] = useState("All leads");
  const [limit, setLimit] = useState(6);
  const [pending, setPending] = useState("");
  const [scope, setScope] = useState("all");
  const [query, setQuery] = useState("");
  const [updateLimit, setUpdateLimit] = useState(5);
  const scoped =
    data && scope === "following" ? selectFollowedBrief(data, following) : data;
  const unread = updates?.filter((u) => !u.read) || [];
  const cards =
    scoped?.cards.filter(
      (c) =>
        (filter === "All leads" ||
          (filter === "Onchain" &&
            ["activity", "counter-change"].includes(c.kind)) ||
          (filter === "Code" && c.kind === "code") ||
          (filter === "Discovery" &&
            ["listing", "baseline"].includes(c.kind))) &&
        `${c.project.name} ${c.project.contract || ""} ${c.headline} ${c.finding}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    ) || [];

  return (
    <div className="daily-brief">
      <details className="source-status-details"><summary>Source update status · {workerSummary(workers)}</summary>
      <section className="worker-pulse" aria-label="Local source workers">
        <div className="list-caption">
          <span>RETURN PATH</span>
          <span>{workerSummary(workers)}</span>
        </div>
        <p className="report-time">
          Persisted evidence survives app restarts. This status is based on
          completed local cycles, not a running-process claim. Missing workers
          never read as live.
        </p>
        <div className="worker-grid">
          {(workers || []).map((w) => (
            <div className="worker-chip" key={w.name}>
              <span className={`worker-dot ${w.freshness}`} />{" "}
              <strong>{w.name}</strong>
              <span>{w.freshness}</span>
              <small>
                Last success: {workerTime(w.lastSuccess)} · {w.cycles} cycle
                {w.cycles === 1 ? "" : "s"}
                {w.lastError && ` · ${w.lastError}`}
              </small>
            </div>
          ))}
        </div>
        {workers === null && (
          <p className="work-error">
            Worker lifecycle status could not be read. Source stories are not
            relabeled fresh.
          </p>
        )}
      </section></details>

      {lastHunt && (
        <section
          className="last-hunt-return"
          aria-label="Last investigation"
        >
          <div className="list-caption">
            <span>YOUR LAST INVESTIGATION</span>
            <span>{lastHunt.status}</span>
          </div>
          <article className="research-update">
            <span className="work-kicker">
              {lastHunt.projectId}
              {lastHunt.stance ? ` · ${lastHunt.stance}` : ""}
            </span>
            <h3>
              {lastHunt.status === "reported"
                ? "Completed Hunt ready to reopen"
                : "Hunt finished without a report"}
            </h3>
            <p>
              {lastHunt.conclusion ||
                "Open the saved mission to inspect what was retained."}
            </p>
            <p className="report-time">
              {lastHunt.evidenceCount
                ? `${lastHunt.evidenceCount} retained evidence record${lastHunt.evidenceCount === 1 ? "" : "s"}${lastHunt.firstEvidenceTx ? ` · first tx ${lastHunt.firstEvidenceTx.slice(0, 10)}…` : ""}`
                : "No transfer evidence rows on this report."}
            </p>
            <div className="brief-actions">
              <Link className="evidence-link" href={lastHunt.href}>
                Reopen investigation →
              </Link>
            </div>
          </article>
        </section>
      )}

      {(unread.length > 0 || error) && <section className="research-inbox" aria-label="Research inbox">
        <div className="list-caption">
          <span>YOUR RESEARCH INBOX</span>
          <span>
            {updates === null ? "Loading…" : `${unread.length} unread`}
          </span>
        </div>
        {error && (
          <p className="work-error" role="alert">
            {error}
          </p>
        )}
        {updates !== null && !unread.length && (
          <p className="report-time">
            No unread research updates. Unchanged checks stay in each thesis’s
            history.
          </p>
        )}
        {unread.slice(0, updateLimit).map((u) => (
          <article className="research-update" key={u.id}>
            <span className="work-kicker">
              {u.projectName} · {time(u.at)}
            </span>
            <h3>{u.title}</h3>
            <p>{u.detail}</p>
            <div className="brief-actions">
              <Link
                className="evidence-link"
                href={`/theses?id=${encodeURIComponent(u.thesisId)}`}
              >
                Open thesis →
              </Link>
              <button
                className="work-refresh work-text-button"
                disabled={Boolean(pending)}
                onClick={async () => {
                  setPending(u.id);
                  try {
                    await onReview(u.id);
                  } finally {
                    setPending("");
                  }
                }}
              >
                Mark reviewed
              </button>
            </div>
          </article>
        ))}
        {unread.length > updateLimit && (
          <button
            className="work-refresh work-text-button"
            onClick={() => setUpdateLimit((n) => n + 5)}
          >
            Show more unread updates
          </button>
        )}
        <Link className="evidence-link" href="/theses">
          All monitored questions →
        </Link>
      </section>}

      <div className="list-caption">
        <span>LEADS TO INVESTIGATE</span>
        <span>{cards.length} grouped leads</span>
      </div>
      <p className="brief-intro">
        What the sources show. Why it matters <em>now</em> (original event
        clocks, not holder volume). What they do not prove.
      </p>
      <div className="work-tabs" role="group" aria-label="Brief scope">
        <button
          aria-pressed={scope === "all"}
          onClick={() => {
            setScope("all");
            setLimit(6);
          }}
        >
          Across Arc
        </button>
        <button
          aria-pressed={scope === "following"}
          onClick={() => {
            setScope("following");
            setLimit(6);
          }}
        >
          My following
        </button>
      </div>
      {scope === "following" && (
        <p className="report-time">
          Your current follows, including observations from before you followed.
          Reading does not mark Changes reviewed.
        </p>
      )}
      <label className="brief-search">
        Find in this brief
        <input
          type="search"
          value={query}
          maxLength={100}
          placeholder="Project, contract address or evidence…"
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(6);
          }}
        />
      </label>
      <div className="work-tabs" role="group" aria-label="Brief filters">
        {["All leads", "Onchain", "Code", "Discovery"].map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => {
              setFilter(f);
              setLimit(6);
            }}
          >
            {f}
          </button>
        ))}
      </div>
      {!data ? (
        <p className="work-empty">Loading the source brief…</p>
      ) : !cards.length ? (
        <p className="work-empty">
          {scope === "following" && !following.length
            ? "Follow a project from its inspector to build your own research desk. Across Arc remains available to explore."
            : "No retained observations match this view in the last 24 hours. Check source coverage below; this is not proof of inactivity."}
        </p>
      ) : (
        cards.slice(0, limit).map((c) => (
          <article className="brief-card" key={c.id}>
            <div className="brief-meta">
              <span className="work-kicker">
                {c.kind.replaceAll("-", " ")}
              </span>
              <span className={`brief-source ${c.sourceStatus}`}>
                {c.sourceStatus === "fresh"
                  ? "Source recently checked"
                  : `Source ${c.sourceStatus}`}
              </span>
            </div>
            <h2>{c.headline}</h2>
            {c.project.contract && (
              <p className="report-time">
                Contract {c.project.contract.slice(0, 8)}…
                {c.project.contract.slice(-6)}
              </p>
            )}
            <p className="brief-finding">{c.finding}</p>
            <p className="brief-why-now">
              <strong>
                Why now{" "}
                <span className={`cooling-chip ${c.cooling}`}>{c.cooling}</span>
              </strong>{" "}
              {c.whyNow}
            </p>
            <p className="brief-why">
              <strong>Why investigate</strong> {c.whyInvestigate}
            </p>
            <p className="brief-counter">
              <strong>Keep in mind</strong> {c.counterevidence}
            </p>
            <p className="report-time">
              Observed {time(c.observedAt)} ·{" "}
              {c.signalAt
                ? `Signal ${time(c.signalAt)}`
                : c.firstEventAt
                  ? `Source events ${time(c.firstEventAt)}${c.lastEventAt !== c.firstEventAt ? ` → ${time(c.lastEventAt!)}` : ""}`
                  : "Source event time unknown"}
              {c.signalAgeMs !== null
                ? ` · age ${Math.max(0, Math.round(c.signalAgeMs / 60000))}m`
                : ""}
            </p>
            <div className="brief-actions">
              <button
                className="work-primary-button"
                onClick={() => onSelect(c.project)}
              >
                Hunt this →
              </button>
              <Link
                className="evidence-link"
                href={`/theses?project=${encodeURIComponent(c.project.id)}`}
              >
                Track a question
              </Link>
            </div>
            <details>
              <summary>Evidence and why this is shown</summary>
              <p className="report-time">
                {c.rankReason} {c.observations} distinct retained observation
                records; up to six source links shown.
              </p>
              {c.evidence.map((e) => (
                <a
                  className="evidence-link"
                  key={e.id}
                  href={e.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {e.title} ↗
                </a>
              ))}
            </details>
          </article>
        ))
      )}
      {cards.length > limit && (
        <button
          className="work-refresh work-text-button"
          onClick={() => setLimit((n) => n + 6)}
        >
          Show six more leads
        </button>
      )}
      {data && (
        <details className="brief-coverage">
          <summary>Coverage, source health and ranking</summary>
          <p>{data.coverage}</p>
          <p>{data.ranking}</p>
          <p>
            Prepared {time(data.generatedAt)} from records observed since{" "}
            {time(data.since)}.
          </p>
          {data.sourceHealth.map((s) => (
            <p className="report-time" key={s.sourceId}>
              {s.sourceId}:{" "}
              {s.error
                ? "last attempt failed"
                : s.lastSuccess
                  ? `last success ${time(s.lastSuccess)}`
                  : "no successful observation"}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}
