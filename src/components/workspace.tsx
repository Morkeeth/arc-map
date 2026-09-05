"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Crosshair,
  Compass,
  Search,
  RefreshCw,
  Terminal,
  Wallet,
  Code2,
  Layers,
  ChevronRight,
  Check,
  LoaderCircle,
} from "lucide-react";
import { projects, type Project } from "@/lib/projects";
import { hunters, type Mission } from "@/lib/hunters";
import type { FeedData } from "@/lib/feed-types";
import type { RadarData } from "@/lib/radar-types";
import { useHunterWallet } from "./wallet-provider";
import { RepositoryPanel } from "./repository-panel";
import { FollowedChanges, type FollowedData } from "./followed-changes";
import { ReportComparison } from "./report-comparison";
import { DailyBrief } from "./daily-brief";
import type { DailyBrief as BriefData } from "@/lib/daily-brief";
import type { ResearchUpdate } from "@/lib/research-updates";

const time = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
type Capability = {
  graphConfigured: boolean;
  escrow: {
    configured: boolean;
    reason: string | null;
    address: string | null;
    executor: string | null;
    service: string | null;
  };
};
async function api(url: string, body?: unknown) {
  const response = await fetch(
    url,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok && !result.mission)
    throw new Error(result.error || "Request failed. Try again.");
  return result;
}
export function Workspace({
  initialView = "today",
}: {
  initialView?: "today" | "discover" | "hunters";
}) {
  const [view, setView] = useState<"today"|"discover"|"hunters"|"changes">(initialView);
  const [brief,setBrief]=useState<BriefData|null>(null),[updates,setUpdates]=useState<ResearchUpdate[]|null>(null),[briefError,setBriefError]=useState<string|null>(null);
  const [feed, setFeed] = useState<FeedData | null>(null);
  const [radar, setRadar] = useState<RadarData | null>(null);
  const [catalogView, setCatalogView] = useState<"radar" | "curated">("radar");
  const [displayLimit, setDisplayLimit] = useState(8);
  const [selected, setSelected] = useState<Project>(projects[0]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All activity");
  const [following, setFollowing] = useState<string[]>([]);
  const [followedData, setFollowedData] = useState<FollowedData|null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [mission, setMission] = useState<Mission | null>(null);
  const [capabilities, setCapabilities] = useState<Capability | null>(null);
  const [indexHealth, setIndexHealth] = useState<{ checkedAt: string; graph: { queryVerified: boolean; fresh: boolean; reason: string | null; indexedBlock: number | null } } | null>(null);
  const [provider, setProvider] = useState<"graph" | "explorer">("graph");
  const [budget, setBudget] = useState("0.05");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tx, setTx] = useState<string | null>(null);
  const [chain, setChain] = useState<{
    funded: boolean;
    completed: boolean;
    closed: boolean;
    reportMatches: boolean;
    remaining: string;
    block: string;
  } | null>(null);
  const wallet = useHunterWallet();
  const detailRef = useRef<HTMLElement>(null);
  const reportRef = useRef<HTMLElement>(null);
  function showProject(project: Project) {
    setSelected(project);
    if (window.innerWidth <= 760)
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView({ block: "start" }),
      );
  }
  useEffect(() => {
    if (mission?.status === "reported" || mission?.status === "blocked")
      reportRef.current?.scrollIntoView({ block: "start" });
  }, [mission?.id, mission?.status]);
  async function load() {
    setError("");
    // Establish the private cookie before any other owner-scoped route starts.
    try {
      let data=await api("/api/follows");
      try { if(!localStorage.getItem("arcmap.follows.migrated.v2")) {
        const legacy=JSON.parse(localStorage.getItem("arcmap.projects.v1")||"[]");
        if(Array.isArray(legacy)) for(const id of legacy.slice(0,100)) {
          if(typeof id==="string" && (projects.some(p=>p.id===id)||/^arc:0x[0-9a-f]{40}$/.test(id))) data=await api("/api/follows",{action:"follow",projectId:id});
        }
        localStorage.setItem("arcmap.follows.migrated.v2","true");
      } } catch { setError("Old local follows could not be imported. Server-saved follows remain available."); }
      setFollowedData(data);setFollowing(data.follows.map((f:{projectId:string})=>f.projectId));setStorageReady(true);
    }
    catch { setError("Saved follows unavailable. Existing data remains visible."); }
    void api("/api/integrations").then(setIndexHealth).catch(() => setIndexHealth(null));
    const results = await Promise.allSettled([
      api("/api/feed"),
      api("/api/hunters"),
      api("/api/missions"),
      api("/api/radar"),
      api("/api/brief"),
      api("/api/research-updates"),
    ]);
    if (results[0].status === "fulfilled") setFeed(results[0].value);
    else setError("Feed unavailable. Existing evidence remains visible.");
    if (results[1].status === "fulfilled")
      setCapabilities(results[1].value.capabilities);
    if (results[2].status === "fulfilled")
      setMissions(results[2].value.missions);
    if (results[3].status === "fulfilled") {
      const updated = results[3].value as RadarData;
      setRadar(updated);
      setSelected(previous => updated.projects.find(p => p.id === previous.id) || previous);
    }
    if(results[4].status==="fulfilled")setBrief(results[4].value);
    if(results[5].status==="fulfilled")setUpdates(results[5].value.updates);
    setBriefError(results[4].status==="rejected"||results[5].status==="rejected"?"Some brief or research updates are unavailable. Saved evidence has not been replaced.":null);
  }
  async function reviewUpdate(id:string){try{const result=await api("/api/research-updates",{ids:[id]});setUpdates(result.updates);setBriefError(null);}catch{setBriefError("Update could not be marked reviewed. Try again.");}}
  useEffect(() => {
    void load();
  }, []);
  async function follow(id: string) {
    setFollowBusy(true);
    try {
      const data=await api("/api/follows",{action:following.includes(id)?"unfollow":"follow",projectId:id});
      setFollowedData(data);setFollowing(data.follows.map((f:{projectId:string})=>f.projectId));
    } catch { setError("Your follow could not be saved. Try again."); }
    finally {setFollowBusy(false);}
  }
  async function reviewChanges() {
    if(!followedData)return;
    setFollowBusy(true);
    try {setFollowedData(await api("/api/follows",{action:"review",ticket:followedData.ticket}));}
    catch {setError("Review could not be saved. Refresh changes and try again.");}
    finally {setFollowBusy(false);}
  }
  function selectMission(item: Mission) {
    setMission(item);
    setChain(null);
    setTx(null);
    const target = allProjects.find((p) => p.id === item.projectId);
    if (target) setSelected(target);
  }
  async function run(previous?:Mission) {
    setBusy("Researching");
    setError("");
    setChain(null);
    setTx(null);
    try {
      const created = await api("/api/missions", {
        projectId: previous?.projectId || selected.id,
        provider: previous?.provider || provider,
        budget: previous?.budget || budget,
        ...(previous?{previousMissionId:previous.id}:{}),
      });
      setMission(created.mission);
      const result = await api(`/api/missions/${created.mission.id}/run`, {});
      setMission(result.mission);
      setMissions((await api("/api/missions")).missions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mission failed.");
    } finally {
      setBusy("");
    }
  }
  async function checkChain() {
    if (!mission) return;
    setBusy("Checking chain");
    setError("");
    try {
      setChain((await api(`/api/missions/${mission.id}/chain`)).chain);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chain unavailable.");
    } finally {
      setBusy("");
    }
  }
  async function transact(action: "fund" | "close") {
    if (!mission || !wallet.address) return;
    setBusy(action === "fund" ? "Review in wallet" : "Reclaiming budget");
    setError("");
    try {
      const prepared = await api(`/api/missions/${mission.id}/chain`, {
        action,
        account: wallet.address,
      });
      const hash = await wallet.send(prepared.transaction);
      setTx(hash);
      setChain((await api(`/api/missions/${mission.id}/chain`)).chain);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Wallet action failed. No success assumed.",
      );
    } finally {
      setBusy("");
    }
  }
  const allProjects = [...projects, ...(radar?.projects || [])];
  const selectedRecord = radar?.records.find(r => r.id === selected.id);
  const graphCovered = selected.contract?.toLowerCase() === projects[0].contract?.toLowerCase();
  const visible = (catalogView === "radar" ? radar?.projects || [] : projects).filter(
    (p) =>
      `${p.name} ${p.symbol} ${p.category} ${p.summary} ${p.question} ${p.contract || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter !== "Following" || following.includes(p.id)),
  );
  const radarEvents = (radar?.events || []).map(e => ({
    id: e.id, projectId: `arc:${e.address.toLowerCase()}`, kind: e.source === "verification" ? "code" : "onchain",
    title: e.title, detail: e.source === "token-list" ? `${e.holders === null ? "Unknown" : e.holders.toLocaleString()} holder addresses reported. This listing is not a launch or a count of people.` : e.source === "verification" ? "Arcscan recorded source-code verification. This is not a security audit or proof of an official deployment." : "A successful contract transaction appears in the sampled recent page. The page is not a complete activity history.",
    sourceUrl: e.sourceUrl, observedAt: e.observedAt, eventAt: e.eventAt,
  }));
  const events = (catalogView === "radar" ? radarEvents : feed?.events || []).filter(
    (e) =>
      visible.some((p) => p.id === e.projectId) &&
      (filter !== "Code" || e.kind === "code") &&
      (filter !== "Onchain" || e.kind !== "code"),
  ).sort((a,b) => Number(Boolean(b.eventAt)) - Number(Boolean(a.eventAt)) || (b.eventAt || b.observedAt).localeCompare(a.eventAt || a.observedAt)).slice(0, 12);
  const report = mission?.report;
  const previousReport=mission?.previousMissionId?missions.find(m=>m.id===mission.previousMissionId):undefined;
  const selectedHunter = selected.researchKind === "contract" ? hunters[1] : hunters[0];
  return (
    <div className="workbench">
      <header className="work-header">
        <Link href="/" className="work-brand">
          <Compass size={25} /> ARC MAP
        </Link>
        <nav aria-label="Main navigation">
          <button className={view==="today"?"active":""} onClick={()=>setView("today")}>Today{updates?.some(u=>!u.read)?` (${updates.filter(u=>!u.read).length})`:""}</button>
          <button
            className={view === "discover" ? "active" : ""}
            onClick={() => setView("discover")}
          >
            Discover
          </button>
          <button
            className={view === "hunters" ? "active" : ""}
            onClick={() => setView("hunters")}
          >
            Hunters
          </button>
          <Link href="/map">
            Map <ArrowUpRight size={13} />
          </Link>
          <button className={view==="changes"?"active":""} onClick={()=>setView("changes")}>Changes{followedData?.events.length?` (${followedData.events.length})`:""}</button>
          <Link href="/agents">
            <Terminal size={15} /> Agents
          </Link>
          <Link href="/theses">Theses</Link>
        </nav>
        <button
          className="wallet-button"
          disabled={!wallet.ready}
          onClick={() =>
            wallet.address ? wallet.disconnect() : wallet.connect()
          }
        >
          <Wallet size={15} />
          {wallet.address
            ? short(wallet.address)
            : wallet.ready
              ? "Connect wallet"
              : "Loading wallet…"}
        </button>
      </header>
      <main className="work-main">
        <div className="work-title">
          <div>
            <span className="work-kicker">
              ARC TESTNET / RESEARCH WORKSPACE
            </span>
            <h1>
              {view==="today"?"What’s worth a closer look.":view === "discover"
                ? "What’s taking shape."
                : view==="changes"?"What changed while you were away.":"Put a thesis to work."}
            </h1>
          </div>
          <button
            className="work-refresh"
            onClick={() => void load()}
            aria-label="Refresh sources"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        {error && (
          <div className="work-error" role="alert">
            {error}
          </div>
        )}
        <div className="work-layout">
          <section className="work-primary">
            {view === "discover" ? (
              <>
                <div className="work-controls">
                  <div className="work-tabs" role="group" aria-label="Discovery catalog">
                    <button aria-pressed={catalogView === "radar"} onClick={() => { setCatalogView("radar"); setDisplayLimit(8); }}>Live radar</button>
                    <button aria-pressed={catalogView === "curated"} onClick={() => { setCatalogView("curated"); setDisplayLimit(8); }}>Curated projects</button>
                  </div>
                  <label className="work-search">
                    <Search size={17} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Find a project, contract or narrative"
                      aria-label="Search projects"
                    />
                  </label>
                  <div
                    className="work-tabs"
                    role="group"
                    aria-label="Activity filters"
                  >
                    {["All activity", "Code", "Onchain", "Following"].map(
                      (f) => (
                        <button
                          key={f}
                          aria-pressed={filter === f}
                          onClick={() => setFilter(f)}
                        >
                          {f}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <div className="project-list">
                  <div className="list-caption">
                    <span>{catalogView === "radar" ? "CONTRACTS UNDER OBSERVATION" : "CURATED PROJECTS"}</span>
                    <span>{visible.length} {catalogView === "radar" ? "observed" : "curated"}</span>
                  </div>
                  {visible.slice(0, displayLimit).map((p) => (
                    <button
                      key={p.id}
                      className={`project-line ${selected.id === p.id ? "selected" : ""}`}
                      onClick={() => showProject(p)}
                    >
                      <span className="project-monogram">
                        {p.symbol.slice(0, 3)}
                      </span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.category}{p.id.startsWith("arc:") && p.contract ? ` · ${short(p.contract)}` : ""}</small>
                      </span>
                      <span className="project-line-summary">{p.summary}</span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                  {visible.length > displayLimit && <button className="work-refresh work-text-button" onClick={() => setDisplayLimit(n => n + 8)}>Show 8 more</button>}
                  {!visible.length && (
                    <p className="work-empty">
                      No projects match this view. Change the filter or follow a
                      project.
                    </p>
                  )}
                </div>
                {catalogView === "radar" && <p className="report-time">{radar?.coverage || "Waiting for the discovery collector. No records are invented."}</p>}
                <div className="list-caption activity-caption">
                  <span>LATEST SOURCE OBSERVATIONS</span>
                  <span>Event dates shown below</span>
                </div>
                <div className="work-feed">
                  {!(catalogView === "radar" ? radar : feed) ? (
                    <p className="work-empty">Loading source observations…</p>
                  ) : !events.length ? (
                    <p className="work-empty">
                      No stored observations match this view.
                    </p>
                  ) : (
                    events.map((event) => (
                      <article className="work-event" key={event.id}>
                        <span className="event-marker">
                          {event.kind === "code" ? (
                            <Code2 size={17} />
                          ) : (
                            <Layers size={17} />
                          )}
                        </span>
                        <div>
                          <div className="event-caption">
                            <button
                              onClick={() =>
                                showProject(
                                  allProjects.find(
                                    (p) => p.id === event.projectId,
                                  )!,
                                )
                              }
                            >
                              {
                                allProjects.find((p) => p.id === event.projectId)!
                                  .name
                              }
                            </button>
                            <span>
                              {event.kind === "baseline"
                                ? "Baseline, not a launch"
                                : event.kind}
                            </span>
                          </div>
                          <a
                            href={event.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <h2>
                              {event.title} <ArrowUpRight size={14} />
                            </h2>
                          </a>
                          <p>{event.detail}</p>
                          <small>
                            {event.eventAt
                              ? `Source event ${time(event.eventAt)}`
                              : "Event time unavailable"}{" "}
                            · Observed {time(event.observedAt)}
                          </small>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </>
            ) : view==="today" ? <DailyBrief data={brief} updates={updates} following={following} onSelect={showProject} onReview={reviewUpdate} error={briefError}/> : view==="changes" ? <FollowedChanges data={followedData} onSelect={showProject} onReview={()=>void reviewChanges()} busy={followBusy}/> : (
              <>
                <section className="hunter-profile">
                  <div className="hunter-insignia">
                    <Crosshair size={32} />
                  </div>
                  <div>
                    <span className="work-kicker">
                      {selectedHunter.code} / SOURCE ANALYSIS
                    </span>
                    <h2>{selectedHunter.name}</h2>
                    <p>{selectedHunter.mandate}</p>
                  </div>
                  <span className="work-tag">Rules-based</span>
                </section>
                <section className="hunter-mandate">
                  <h3>The mandate</h3>
                  <p>{selectedHunter.description}</p>
                  <h3>What would change the view?</h3>
                  <p>{selectedHunter.falsifier}</p>
                  <div className="hunter-tool-list">
                    {selectedHunter.tools.map((t) => (
                      <span key={t}>
                        <Terminal size={12} />
                        {t.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                </section>
                <div className="list-caption">
                  <span>YOUR RESEARCH MISSIONS</span>
                  <span>Private browser session</span>
                </div>
                {!missions.length ? (
                  <p className="work-empty">
                    No missions yet. Choose the sourced SUN contract and run
                    your first investigation.
                  </p>
                ) : (
                  missions.map((m) => (
                    <button
                      className={`mission-line ${mission?.id === m.id ? "selected" : ""}`}
                      key={m.id}
                      onClick={() => selectMission(m)}
                    >
                      <Crosshair size={18} />
                      <span>
                        <strong>
                          {allProjects.find((p) => p.id === m.projectId)?.name || m.projectId}
                        </strong>
                        <small>
                          {time(m.createdAt)} · {m.provider}
                        </small>
                      </span>
                      <span className={`status-label ${m.status}`}>
                        {m.status}
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))
                )}
                <div className="research-boundary">
                  <strong>Research first. Capital with limits.</strong>
                  <p>
                    Mission funding pays a fixed research fee. It is not an
                    investment, a trade, or ownership of this Hunter. Strategy
                    shares are not available.
                  </p>
                </div>
              </>
            )}
          </section>
          <aside
            ref={detailRef}
            className="work-detail"
            aria-label="Selected project and Hunter mission"
          >
            <div className="detail-heading">
              <span className="project-monogram">
                {selected.symbol.slice(0, 3)}
              </span>
              <div>
                <span className="work-kicker">{selected.category}</span>
                <h2>{selected.name}</h2>
              </div>
              <button
                className="follow-compact"
                disabled={!storageReady || followBusy}
                onClick={() => void follow(selected.id)}
              >
                {following.includes(selected.id) ? <Check size={17} /> : "+"}
                <span>
                  {following.includes(selected.id) ? "Following" : "Follow"}
                </span>
              </button>
            </div>
            <p className="detail-summary">{selected.summary}</p>
            <p className="detail-relation">{selected.relation}</p>
            <div className="detail-links">
              <Link href={`/projects/${selected.id}`}>
                Project evidence <ArrowUpRight size={13} />
              </Link>
              <a href={selected.reference} target="_blank" rel="noreferrer">
                Source <ArrowUpRight size={13} />
              </a>
            </div>
            {selected.contract && (
              <a
                className="contract-link"
                href={`https://testnet.arcscan.app/address/${selected.contract}`}
                target="_blank"
                rel="noreferrer"
              >
                Contract {short(selected.contract)} <ArrowUpRight size={13} />
              </a>
            )}
            {selectedRecord && <p className="report-time">First observed {time(selectedRecord.firstObservedAt)}. {selectedRecord.verifiedAt && `Source verified ${time(selectedRecord.verifiedAt)}. `}{selectedRecord.lastActivityAt && `Sampled activity ${time(selectedRecord.lastActivityAt)}. `}No launch date inferred.</p>}
            <Link className="evidence-link" href={`/theses?project=${encodeURIComponent(selected.id)}`}>Track a thesis about this project <ArrowRight size={13}/></Link>
            {selected.repo && <RepositoryPanel key={selected.id} projectId={selected.id}/>}
            <section className="mission-composer">
              <span className="work-kicker">
                <Crosshair size={13} /> THE HUNT
              </span>
              <h3>{selectedHunter.question}</h3>
              {!selected.contract ? (
                <p className="work-empty">
                  No verified contract association is configured for this
                  profile. Contract research is unavailable; use its linked
                  source evidence.
                </p>
              ) : (
                <>
                  <label>
                    Evidence source
                    <select
                      value={provider}
                      onChange={(e) =>
                        setProvider(e.target.value as "graph" | "explorer")
                      }
                    >
                      <option value="graph" disabled={!graphCovered}>
                        The Graph · transfer subgraph
                      </option>
                      <option value="explorer">
                        Arcscan · free research preview
                      </option>
                    </select>
                  </label>
                  {!graphCovered && <p className="setup-note">This target is outside the deployed Graph index. Choose Arcscan explicitly for a free preview. Graph coverage will not be implied.</p>}
                  {provider === "graph" && !capabilities?.graphConfigured && (
                    <p className="setup-note">
                      Graph endpoint not configured. A Graph run will stop with
                      a visible error; it will not substitute explorer data.
                    </p>
                  )}
                  {provider === "graph" && capabilities?.graphConfigured && (
                    <p className="setup-note" role="status">
                      {indexHealth?.graph.fresh
                        ? `Graph index checked at block ${indexHealth.graph.indexedBlock}. Funding is still checked per mission.`
                        : indexHealth?.graph.reason || "Checking live index readiness. Configuration alone does not enable funding."}
                      {indexHealth && ` Checked ${time(indexHealth.checkedAt)}.`}
                    </p>
                  )}
                  <label>
                    Proposed mission budget <span>testnet USDC</span>
                    <input
                      type="number"
                      min="0.01"
                      max="10"
                      step="0.01"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                    />
                  </label>
                  <div className="mission-terms">
                    <span>
                      Fixed service fee <strong>0.01 USDC</strong>
                    </span>
                    <span>
                      Owner may cancel <strong>Until settlement</strong>
                    </span>
                    <span>
                      Mission deadline <strong>24 hours from creation</strong>
                    </span>
                  </div>
                  <button
                    className="work-primary-button"
                    disabled={Boolean(busy) || (provider === "graph" && !graphCovered)}
                    onClick={() => {
                      setView("hunters");
                      void run();
                    }}
                  >
                    {busy === "Researching" ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Crosshair size={16} />
                    )}
                    Run research preview <ArrowRight size={16} />
                  </button>
                  <small className="no-charge">
                    No wallet charge. Review evidence before funding.
                  </small>
                </>
              )}
            </section>
          </aside>
        </div>
        {mission && (
          <section
            ref={reportRef}
            className="mission-report"
            aria-live="polite"
          >
            {previousReport && report && <ReportComparison previous={previousReport} current={mission}/>}
            {report && <button className="work-refresh work-text-button" disabled={Boolean(busy)} onClick={()=>void run(mission)}>{busy||"Run again and compare"}</button>}
            <div className="report-heading">
              <div>
                <span className="work-kicker">MISSION {short(mission.id)}</span>
                <h2>
                  {report
                    ? "The Hunter’s findings."
                    : mission.status === "blocked"
                      ? "Research could not proceed."
                      : "Investigation in progress."}
                </h2>
              </div>
              <span className={`status-label ${mission.status}`}>
                {mission.status}
              </span>
            </div>
            {mission.error && <p className="work-error">{mission.error}</p>}
            {report && (
              <>
                <div className="report-conclusion">
                  <span className="work-kicker">
                    {report.stance.replaceAll("-", " ").toUpperCase()}
                  </span>
                  <h3>{report.conclusion}</h3>
                </div>
                <div className="report-facts">
                  <div>
                    <strong>{report.sampleSize}</strong>
                    <span>sampled events</span>
                  </div>
                  <div>
                    <strong>{report.transactions}</strong>
                    <span>distinct transactions</span>
                  </div>
                  <div>
                    <strong>{report.indexedBlock ?? "—"}</strong>
                    <span>Graph indexed block</span>
                  </div>
                  <div>
                    <strong>
                      {report.provider === "graph" ? "The Graph" : "Arcscan"}
                    </strong>
                    <span>explicit evidence provider</span>
                  </div>
                </div>
                <div className="report-columns">
                  <div>
                    <h3>Research trail</h3>
                    {report.steps.map((s, i) => (
                      <div className="research-step" key={s.tool}>
                        <span>0{i + 1}</span>
                        <div>
                          <strong>{s.tool.replaceAll("_", " ")}</strong>
                          <p>{s.result}</p>
                        </div>
                      </div>
                    ))}
                    <h3>Source transactions</h3>
                    {[
                      ...new Set(report.evidence.map((e) => e.transaction)),
                    ].map((hash) => (
                      <a
                        className="evidence-link"
                        key={hash}
                        href={`https://testnet.arcscan.app/tx/${hash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {short(hash)} <ArrowUpRight size={13} />
                      </a>
                    ))}
                    <p className="report-time">
                      Observed {time(report.observedAt)}. Sample:{" "}
                      {report.firstEventAt
                        ? time(report.firstEventAt)
                        : "unknown"}{" "}
                      →{" "}
                      {report.lastEventAt
                        ? time(report.lastEventAt)
                        : "unknown"}
                      .
                    </p>
                  </div>
                  <div>
                    <h3>What this does not prove</h3>
                    {report.limitations.map((l) => (
                      <p className="limitation" key={l}>
                        {l}
                      </p>
                    ))}
                    <details>
                      <summary>Report content hash and JSON</summary>
                      <code className="report-hash">{mission.reportHash}</code>
                      <a
                        href={`/api/missions/${mission.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open private mission JSON <ArrowUpRight size={13} />
                      </a>
                    </details>
                  </div>
                </div>
                <div className="funding-panel">
                  <div>
                    <h3>Approve a bounded mission.</h3>
                    <p>
                      Budget {mission.budget} testnet USDC · fixed fee{" "}
                      {mission.fee} · surplus reclaimable. An executor commits
                      the report hash to collect the fee; this is not proof that
                      the report is correct.
                    </p>
                    {!capabilities?.escrow.configured && (
                      <p className="setup-note">
                        {capabilities?.escrow.reason ||
                          "Checking escrow configuration…"}
                      </p>
                    )}
                    {capabilities?.escrow.configured && (
                      <p className="report-time">
                        Escrow {capabilities.escrow.address} · executor{" "}
                        {capabilities.escrow.executor} · payee{" "}
                        {capabilities.escrow.service}
                      </p>
                    )}
                  </div>
                  <div className="funding-actions">
                    {!wallet.address ? (
                      <button
                        disabled={!wallet.ready}
                        onClick={() => wallet.connect()}
                      >
                        Connect wallet
                      </button>
                    ) : (
                      <button
                        disabled={
                          Boolean(busy) ||
                          !capabilities?.escrow.configured ||
                          mission.provider !== "graph" ||
                          Boolean(chain?.funded)
                        }
                        onClick={() => void transact("fund")}
                      >
                        Review funding in wallet
                      </button>
                    )}
                    <button
                      disabled={
                        Boolean(busy) || !capabilities?.escrow.configured
                      }
                      onClick={() => void checkChain()}
                    >
                      Verify onchain state
                    </button>
                    <button
                      disabled={
                        Boolean(busy) ||
                        !wallet.address ||
                        !chain?.funded ||
                        chain.closed
                      }
                      onClick={() => void transact("close")}
                    >
                      Cancel / reclaim surplus
                    </button>
                  </div>
                </div>
                {busy && <p role="status">{busy}…</p>}
                {tx && (
                  <a
                    className="evidence-link"
                    href={`https://testnet.arcscan.app/tx/${tx}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Confirmed transaction {short(tx)} <ArrowUpRight size={13} />
                  </a>
                )}
                {chain && (
                  <p className="chain-state">
                    Verified at block {chain.block}:{" "}
                    {chain.closed
                      ? "closed"
                      : chain.completed
                        ? "settled"
                        : chain.funded
                          ? "funded, awaiting executor"
                          : "not funded"}
                    {chain.completed
                      ? ` · report commitment ${chain.reportMatches ? "matches" : "DOES NOT MATCH"}`
                      : ""}
                    .
                  </p>
                )}
              </>
            )}
          </section>
        )}
        <footer className="work-footer">
          <span>Bounded live radar + curated sources · GitHub + Arcscan · X not connected</span>
          <span>
            Testnet only · Private workspace follows · No investment returns
          </span>
        </footer>
      </main>
    </div>
  );
}
