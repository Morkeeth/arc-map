"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  Code2,
  Compass,
  ExternalLink,
  Layers,
  LoaderCircle,
  RefreshCw,
  Search,
  Sparkles,
  Telescope,
  Terminal,
} from "lucide-react";
import { projects, type Project, sourceIds } from "@/lib/projects";
import type { FeedData, FeedEvent } from "@/lib/feed-types";
import type { HuntReport } from "@/lib/types";

const stamp = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
function useFollowing() {
  const [following, setFollowing] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("arcmap.projects.v1") || "[]",
      );
      if (Array.isArray(saved))
        setFollowing(
          saved.filter(
            (id) =>
              typeof id === "string" &&
              projects.some((project) => project.id === id),
          ),
        );
    } catch {
      setError(true);
    }
    setReady(true);
  }, []);
  function toggle(id: string) {
    setFollowing((previous) => {
      const next = previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id];
      try {
        localStorage.setItem("arcmap.projects.v1", JSON.stringify(next));
      } catch {
        setError(true);
      }
      return next;
    });
  }
  return { following, toggle, ready, error };
}

export function DiscoveryHeader() {
  return (
    <header className="discovery-header">
      <Link href="/" className="discovery-brand">
        <span>
          <Compass size={23} />
        </span>
        ARC MAP<span className="edition-pill">FIELD EDITION</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/">Today</Link>
        <Link href="/map">The map</Link>
        <Link href="/agents">
          <Terminal size={15} /> For agents
        </Link>
      </nav>
    </header>
  );
}

export function Scout({ large = false }: { large?: boolean }) {
  return (
    <div
      className={`scout-figure ${large ? "scout-large" : ""}`}
      aria-hidden="true"
    >
      <div className="scout-orbit" />
      <div className="scout-body">
        <div className="scout-eyes">
          <i />
          <i />
        </div>
        <div className="scout-grin" />
      </div>
      <div className="scout-lens">
        <Search />
      </div>
      <span className="scout-sticker">BRING RECEIPTS.</span>
    </div>
  );
}

function Follow({
  project,
  state,
}: {
  project: Project;
  state: ReturnType<typeof useFollowing>;
}) {
  const active = state.following.includes(project.id);
  return (
    <button
      className={`follow-project ${active ? "saved" : ""}`}
      disabled={!state.ready}
      onClick={() => state.toggle(project.id)}
      aria-pressed={active}
      aria-label={`${active ? "Unfollow" : "Follow"} ${project.name}`}
    >
      <Bookmark size={16} fill={active ? "currentColor" : "none"} />
      <span>{active ? "Following" : "Follow"}</span>
    </button>
  );
}

function EventCard({ event }: { event: FeedEvent }) {
  const project = projects.find((item) => item.id === event.projectId)!;
  return (
    <article className="signal-card">
      <div className={`signal-icon ${event.kind}`}>
        {event.kind === "code" ? <Code2 size={20} /> : <Layers size={20} />}
      </div>
      <div className="signal-content">
        <div className="signal-meta">
          <Link href={`/projects/${project.id}`}>{project.name}</Link>
          <span>
            {event.kind === "baseline"
              ? "Tracking baseline"
              : event.kind === "code"
                ? "Code trail"
                : "Onchain observation"}
          </span>
        </div>
        <h3>
          <Link href={`/projects/${project.id}`}>{event.title}</Link>
        </h3>
        <p>{event.detail}</p>
        {event.baselineAt && event.kind === "onchain" && (
          <p className="signal-window">
            Compared with {stamp(event.baselineAt)}. Not a 24-hour activity
            metric.
          </p>
        )}
        <div className="signal-foot">
          <span>
            {event.eventAt
              ? `Source event ${stamp(event.eventAt)}`
              : "Event time unavailable"}
            <small>Observed {stamp(event.observedAt)}</small>
          </span>
          <a href={event.sourceUrl} target="_blank" rel="noreferrer">
            Check source <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </article>
  );
}

export function Today() {
  const [data, setData] = useState<FeedData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All signals");
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const follows = useFollowing();
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/feed");
      if (!response.ok)
        throw new Error("Feed unavailable. Your previous view is still here.");
      setData(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Feed unavailable.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    try {
      const value = localStorage.getItem("arcmap.caught-up.v1");
      if (value && Number.isFinite(Date.parse(value))) setLastVisit(value);
    } catch {
      /* Follows reports storage availability separately. */
    }
  }, []);
  const matches = projects.filter((project) =>
    `${project.name} ${project.category} ${project.summary}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const events = (data?.events || []).filter(
    (event) =>
      matches.some((project) => project.id === event.projectId) &&
      (filter !== "Following" || follows.following.includes(event.projectId)) &&
      (filter !== "Code" || event.kind === "code") &&
      (filter !== "Onchain" || event.kind !== "code"),
  );
  const fresh =
    data?.sources.filter(
      (source) =>
        !source.error &&
        source.lastSuccess &&
        Date.now() - Date.parse(source.lastSuccess) < 900_000,
    ).length || 0;
  const unseen =
    data?.events.filter(
      (event) =>
        lastVisit && Date.parse(event.observedAt) > Date.parse(lastVisit),
    ).length || 0;
  return (
    <>
      <DiscoveryHeader />
      <main className="discovery-page">
        <section className="discovery-hero">
          <div>
            <span className="field-label">
              <span /> YOUR DAILY DOSE OF ARC
            </span>
            <h1>
              Less noise.
              <br />
              <em>More rabbit holes.</em>
            </h1>
            <p>
              What people claim. What builders ship.
              <br />
              What the chain actually shows. Connect the dots.
            </p>
            <div className="hero-actions">
              <Link className="blue-action" href="/map">
                Unfold the map <ArrowUpRight size={17} />
              </Link>
              <a className="text-action" href="#signals">
                See the evidence <ArrowRight size={16} />
              </a>
            </div>
          </div>
          <div className="hero-scout">
            <span className="floating-note">
              curiosity has entered the chat ↗
            </span>
            <Scout large />
          </div>
        </section>
        <div className="source-ribbon">
          <span>
            <span className={`health-dot ${fresh ? "healthy" : ""}`} /> {fresh}{" "}
            / {projects.flatMap(sourceIds).length} tracked sources checked within 15 min
          </span>
          <span>GitHub + Arcscan</span>
          <span>X: not connected</span>
          <span>ARC TESTNET · NOT MAINNET</span>
        </div>
        <div className="discovery-columns">
          <section className="feed-column" id="signals">
            <div className="section-top">
              <div>
                <span className="field-label">THE FIELD NOTES</span>
                <h2>What’s worth a closer look?</h2>
              </div>
              <button
                className="refresh-feed"
                onClick={() => void refresh()}
                disabled={loading}
                aria-label="Refresh feed"
              >
                <RefreshCw size={17} className={loading ? "spin" : ""} />
              </button>
            </div>
            <p className="section-caption">
              Latest tracked evidence, not a claim that every event happened
              today.
            </p>
            <div className="feed-controls">
              <label>
                <Search size={17} />
                <input
                  aria-label="Search projects and signals"
                  placeholder="Find a project or rabbit hole…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div>
                {["All signals", "Code", "Onchain", "Following"].map((item) => (
                  <button
                    key={item}
                    aria-pressed={filter === item}
                    onClick={() => setFilter(item)}
                    className={filter === item ? "active" : ""}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p className="feed-notice" role="alert">
                {error}
              </p>
            )}
            {follows.error && (
              <p className="feed-notice">
                Browser storage is unavailable. Follows may not survive this
                visit.
              </p>
            )}
            {lastVisit && (
              <div className="caught-up">
                <span>
                  {unseen
                    ? `${unseen} new observations since you caught up.`
                    : "You’re caught up with the stored feed."}
                </span>
                <button
                  onClick={() => {
                    const now = new Date().toISOString();
                    try {
                      localStorage.setItem("arcmap.caught-up.v1", now);
                      setLastVisit(now);
                    } catch {
                      setError("Could not save your reading position.");
                    }
                  }}
                >
                  Mark read <Check size={14} />
                </button>
              </div>
            )}
            {loading && !data ? (
              <div className="feed-empty">
                <LoaderCircle className="spin" />
                <h3>Opening the field notes…</h3>
              </div>
            ) : events.length ? (
              <div className="signal-list">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="feed-empty">
                <Telescope size={32} />
                <h3>
                  {filter === "Following"
                    ? "Choose your first rabbit hole."
                    : "No observations in this view yet."}
                </h3>
                <p>
                  {filter === "Following"
                    ? "Follow a project below to build your own feed."
                    : "Stored source observations appear here after ingestion. No evidence is being filled in."}
                </p>
              </div>
            )}
            {!lastVisit && !!data?.events.length && (
              <button
                className="mark-read"
                onClick={() => {
                  const now = new Date().toISOString();
                  try {
                    localStorage.setItem("arcmap.caught-up.v1", now);
                    setLastVisit(now);
                  } catch {
                    setError("Could not save your reading position.");
                  }
                }}
              >
                I’m caught up <Check size={15} />
              </button>
            )}
          </section>
          <aside className="field-sidebar">
            <section className="hunt-teaser">
              <span className="field-label">THE HUNT / CASE 001</span>
              <div className="case-stamp">OPEN QUESTION</div>
              <h2>
                A crowd of holders.
                <br />
                But who came back?
              </h2>
              <p>
                SUN’s distribution is our first rabbit hole. Inspect the source,
                then send a scout after the transfers.
              </p>
              <Link className="blue-action" href="/projects/sun-token">
                Open the case <ArrowUpRight size={16} />
              </Link>
              <small>Editorial question · not a fraud allegation</small>
            </section>
            <section className="agent-teaser">
              <Terminal size={23} />
              <h3>Your agent is invited.</h3>
              <p>
                Same projects. Same sources. A read-only API to follow the
                evidence.
              </p>
              <Link href="/agents">
                Give it a lead <ArrowRight size={15} />
              </Link>
            </section>
            <div className="field-motto">
              a little less doomscroll.
              <br />
              <strong>a little more discovery.</strong>
            </div>
          </aside>
        </div>
        <section className="project-directory" id="projects">
          <div className="section-top">
            <div>
              <span className="field-label">PLACES TO START</span>
              <h2>Pick a rabbit hole.</h2>
            </div>
            <span className="directory-count">
              {matches.length} curated profiles · coverage is growing
            </span>
          </div>
          <div className="project-cards">
            {matches.map((project) => (
              <article className="project-card" key={project.id}>
                <div className="project-card-top">
                  <Link
                    href={`/projects/${project.id}`}
                    className={`project-sticker sticker-${project.id}`}
                  >
                    {project.symbol}
                    <Sparkles size={13} />
                  </Link>
                  <Follow project={project} state={follows} />
                </div>
                <span className="project-category">{project.category}</span>
                <h3>
                  <Link href={`/projects/${project.id}`}>
                    {project.name} <ArrowUpRight size={17} />
                  </Link>
                </h3>
                <p>{project.summary}</p>
                <Link
                  className="project-question"
                  href={`/projects/${project.id}`}
                >
                  {project.question} <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        </section>
        <footer className="discovery-footer">
          <p>
            {data?.coverage ||
              "Curated Arc profiles. Source observations are loading."}
          </p>
          <span>Independent field guide. Following stays in this browser.</span>
        </footer>
      </main>
    </>
  );
}

export function ProjectDetail({ project }: { project: Project }) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [sources, setSources] = useState<FeedData["sources"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<HuntReport | null>(null);
  const [running, setRunning] = useState(false);
  const follows = useFollowing();
  useEffect(() => {
    fetch(`/api/projects/${project.id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Project evidence unavailable");
        const data = await response.json();
        setEvents(data.events);
        setSources(data.sources);
      })
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [project.id]);
  async function hunt() {
    if (!project.contract) return;
    setRunning(true);
    setError("");
    setReport(null);
    try {
      const response = await fetch(`/api/hunt?address=${project.contract}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Scout unavailable");
      setReport(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scout unavailable");
    } finally {
      setRunning(false);
    }
  }
  return (
    <>
      <DiscoveryHeader />
      <main className="discovery-page project-detail">
        <Link href="/" className="back-link">
          ← Back to the field
        </Link>
        <section className="project-intro">
          <div className={`project-sticker sticker-${project.id}`}>
            {project.symbol}
            <Sparkles size={18} />
          </div>
          <div>
            <span className="field-label">
              {project.category} / ARC ECOSYSTEM
            </span>
            <h1>{project.name}</h1>
            <p>{project.summary}</p>
          </div>
          <Follow project={project} state={follows} />
        </section>
        <div className="project-detail-grid">
          <section>
            <div className="project-thesis">
              <span className="field-label">OUR QUESTION, NOT A VERDICT</span>
              <h2>{project.question}</h2>
              <p>{project.context}</p>
            </div>
            <section className="source-box">
              <h3>Connect the dots.</h3>
              <p>{project.relation}</p>
              <div className="source-links">
                <a href={project.website} target="_blank" rel="noreferrer">
                  {project.contract ? "Explorer profile" : "Project source"}
                  <ExternalLink size={14} />
                </a>
                <a href={project.reference} target="_blank" rel="noreferrer">
                  Association evidence <ExternalLink size={14} />
                </a>
                {project.repo && (
                  <a
                    href={`https://github.com/${project.repo}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub repository <Code2 size={14} />
                  </a>
                )}
              </div>
              {project.contract && (
                <p className="contract-address">
                  Arc Testnet contract
                  <br />
                  <code>{project.contract}</code>
                </p>
              )}
              <p className="quiet">
                An established source association is not a safety guarantee.
                Social ingestion and wallet actions are not enabled.
              </p>
            </section>
            <div className="section-top">
              <h2>The evidence trail.</h2>
            </div>
            {loading ? (
              <p className="feed-notice">Loading stored observations…</p>
            ) : events.length ? (
              events.map((event) => <EventCard event={event} key={event.id} />)
            ) : (
              <div className="feed-empty">
                <h3>No indexed observations yet.</h3>
                <p>
                  This profile has source links, not an inferred live
                  deployment.
                </p>
              </div>
            )}
          </section>
          <aside>
            <section className="hunt-teaser">
              <span className="field-label">THE HUNT</span>
              <Scout />
              <h2>Curiosity needs receipts.</h2>
              <p>
                {project.contract
                  ? "Send a read-only scout to inspect the latest returned transfer page."
                  : "Start with the sources. Automated repository investigations are not connected yet."}
              </p>
              {project.contract ? (
                <button
                  className="blue-action"
                  disabled={running}
                  onClick={() => void hunt()}
                >
                  {running ? (
                    <>
                      <LoaderCircle className="spin" size={16} /> Following the
                      trail…
                    </>
                  ) : (
                    <>
                      Hunt this <ArrowUpRight size={17} />
                    </>
                  )}
                </button>
              ) : (
                <a
                  className="blue-action"
                  href={project.reference}
                  target="_blank"
                  rel="noreferrer"
                >
                  Inspect the source <ArrowUpRight size={17} />
                </a>
              )}
              <small>Fixed evidence scout · no spend · no signing</small>
            </section>
            <section className="source-box source-status">
              <h3>Source status</h3>
              {sourceIds(project).length === 0 ? (
                <p>
                  Curated association only. Automated tracking is not
                  configured.
                </p>
              ) : sources.length ? (
                sources.map((source) => (
                  <div key={source.sourceId}>
                    <strong>
                      {source.sourceId.startsWith("github:")
                        ? "GitHub"
                        : "Arcscan"}
                    </strong>
                    <p>
                      {source.error ||
                        (source.lastSuccess &&
                        Date.now() - Date.parse(source.lastSuccess) > 900_000
                          ? "Stale: last successful check is over 15 minutes old."
                          : "Last check succeeded.")}
                    </p>
                    <small>
                      {source.lastSuccess
                        ? stamp(source.lastSuccess)
                        : "No successful check yet"}
                    </small>
                  </div>
                ))
              ) : (
                <p>Awaiting first source check.</p>
              )}
            </section>
          </aside>
        </div>
        {error && (
          <p className="feed-notice" role="alert">
            {error}
          </p>
        )}
        {follows.error && (
          <p className="feed-notice">
            Could not persist follows in this browser.
          </p>
        )}
        {report && (
          <section className="case-result" aria-live="polite">
            <span className="field-label">
              <Check size={16} /> SCOUT RETURNED
            </span>
            <h2>Brought receipts.</h2>
            <div className="case-stats">
              <div>
                <strong>{report.examined}</strong>
                <span>sampled events</span>
              </div>
              <div>
                <strong>{report.uniqueTransactions}</strong>
                <span>transactions in sample</span>
              </div>
              <div>
                <strong>{report.uniqueSenders}</strong>
                <span>sender addresses</span>
              </div>
            </div>
            {report.observations.map((text) => (
              <p key={text}>{text}</p>
            ))}
            {report.newestTransferAt && (
              <p>
                Latest sampled event: {stamp(report.newestTransferAt)}.
                Retrieved: {stamp(report.fetchedAt)}.
              </p>
            )}
            <p className="case-limits">{report.limitation}</p>
            <a href={report.source} target="_blank" rel="noreferrer">
              Open the source response <ArrowUpRight size={15} />
            </a>
          </section>
        )}
        <footer className="discovery-footer">
          Project profile, not an endorsement. ARC MAP / FIELD EDITION
        </footer>
      </main>
    </>
  );
}
