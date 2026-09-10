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
import { loadBrowserFollows } from "@/lib/browser-follows";
import { missionForReturn } from "@/lib/mission-return";
import { lastHuntReturn } from "@/lib/last-hunt-return";
import type { FeedData } from "@/lib/feed-types";
import type { RadarData } from "@/lib/radar-types";
import { useHunterWallet } from "./wallet-provider";
import { RepositoryPanel } from "./repository-panel";
import { FollowedChanges, type FollowedData } from "./followed-changes";
import { ReportComparison } from "./report-comparison";
import { DailyBrief } from "./daily-brief";
import type { BriefCard, DailyBrief as BriefData } from "@/lib/daily-brief";
import type { ResearchUpdate } from "@/lib/research-updates";
import { actionProposalFor } from "@/lib/action-proposal";
import { ActionProposalPanel } from "./action-proposal-panel";
import { formatEther } from "viem";
import type {
  MissionFundingReceipt,
  PreparedMissionTransaction,
} from "@/lib/funding-types";
import {
  assessEvidenceCoverage,
  type EvidenceCoverageAssessment,
} from "@/lib/evidence-coverage";

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
type WorkerData = { name: string; lastSuccess: string | null; lastError: string | null; cycles: number; freshness: "running" | "stale" | "failed" | "stopped" | "missing" };
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
  initialMissionId,
  initialProject,
}: {
  initialView?: "today" | "discover" | "hunters";
  initialMissionId?: string;
  initialProject?: Project;
}) {
  const [view, setView] = useState<"today"|"discover"|"hunters"|"changes">(initialView);
  const [brief,setBrief]=useState<BriefData|null>(null),[updates,setUpdates]=useState<ResearchUpdate[]|null>(null),[briefError,setBriefError]=useState<string|null>(null);
  const [workers,setWorkers]=useState<WorkerData[]|null>(null);
  const [feed, setFeed] = useState<FeedData | null>(null);
  const [radar, setRadar] = useState<RadarData | null>(null);
  const [catalogView, setCatalogView] = useState<"radar" | "curated">("radar");
  const [displayLimit, setDisplayLimit] = useState(8);
  const [selected, setSelected] = useState<Project>(initialProject ?? projects[0]);
  const [story, setStory] = useState<BriefCard | null>(null);
  const [followNotice, setFollowNotice] = useState("");
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
  const [provider, setProvider] = useState<"graph" | "explorer">(process.env.NEXT_PUBLIC_RESEARCH_PREVIEW === "1" ? "explorer" : "graph");
  const [budget, setBudget] = useState("0.05");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tx, setTx] = useState<string | null>(null);
  const [preparedFunding, setPreparedFunding] =
    useState<PreparedMissionTransaction | null>(null);
  const [chain, setChain] = useState<{
    funded: boolean;
    completed: boolean;
    closed: boolean;
    reportMatches: boolean;
    remaining: string;
    block: string;
  } | null>(null);
  const wallet = useHunterWallet();
  const researchPreview = process.env.NEXT_PUBLIC_RESEARCH_PREVIEW === "1";
  const targetGeneration = useRef(0);
  const newTarget = useRef(Boolean(initialProject));
  const detailRef = useRef<HTMLElement>(null);
  const reportRef = useRef<HTMLElement>(null);
  function showProject(project: Project) {
    targetGeneration.current += 1;
    newTarget.current = true;
    setSelected(project);
    setStory(null);
    setMission(null);
    setChain(null);
    setError("");
    setFollowNotice("");
    if (window.innerWidth <= 760)
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView({ block: "start" }),
      );
  }
  function startInvestigation(project: Project, lead?: BriefCard) {
    showProject(project);
    setStory(lead ?? null);
    setView("hunters");
    if (window.innerWidth <= 760)
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          detailRef.current?.scrollIntoView({ block: "start" }),
        ),
      );
  }
  useEffect(() => {
    if (mission?.status === "reported" || mission?.status === "blocked")
      reportRef.current?.scrollIntoView({ block: "start" });
  }, [mission?.id, mission?.status]);
  useEffect(() => {
    if (!mission) return;
    const target = [...projects, ...(radar?.projects || [])].find(
      (project) => project.id === mission.projectId,
    );
    if (target) setSelected(target);
  }, [mission?.id, mission?.projectId, radar]);
  useEffect(() => {
    setPreparedFunding(mission?.fundingIntent ?? null);
  }, [mission?.id, mission?.fundingIntent?.policy?.bindingHash]);
  async function load() {
    setError("");
    // Establish the private cookie before any other owner-scoped route starts.
    try {
      const {data,migrationError} = await loadBrowserFollows();
      if(migrationError)setError("Some old browser follows could not be imported. They remain in browser storage; server-saved follows are available.");
      setFollowedData(data);setFollowing(data.follows.map((f:{projectId:string})=>f.projectId));setStorageReady(true);
    }
    catch { setError("Saved follows unavailable. Existing data remains visible."); }
    void api("/api/integrations").then(setIndexHealth).catch(() => setIndexHealth(null));
    void api("/api/workers").then(result => setWorkers(result.workers)).catch(() => setWorkers(null));
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
    if (results[2].status === "fulfilled") {
      const nextMissions = results[2].value.missions as Mission[];
      setMissions(nextMissions);
      setMission((current) => {
        if (current?.status === "researching") {
          return (
            nextMissions.find((item) => item.id === current.id) || current
          );
        }
        if (current && nextMissions.some((item) => item.id === current.id)) {
          return (
            nextMissions.find((item) => item.id === current.id) || current
          );
        }
        if(initialMissionId && !nextMissions.some(m=>m.id===initialMissionId)) {setError("This investigation is not available in your private workspace. Choose a saved Hunt below or start a new one.");return null;}
        return newTarget.current && !current ? null : missionForReturn(nextMissions, initialMissionId);
      });
    }
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
      setFollowNotice(data.follows.some((f:{projectId:string})=>f.projectId===id) ? "Saved. Return to Changes to compare source observations; reading does not reset your baseline." : "Removed from following.");
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
    targetGeneration.current += 1;
    newTarget.current = false;
    setMission(item);
    setStory(null);
    setChain(null);
    setTx(null);
    setPreparedFunding(item.fundingIntent ?? null);
    const target = allProjects.find((p) => p.id === item.projectId);
    if (target) setSelected(target);
  }
  async function run(previous?:Mission) {
    const generation = targetGeneration.current;
    newTarget.current = false;
    setBusy("Researching");
    setError("");
    setChain(null);
    setTx(null);
    try {
      const created = await api("/api/missions", {
        projectId: previous?.projectId || selected.id,
        provider: previous?.provider || provider,
        budget: previous?.budget || budget,
        ...(previous?{previousMissionId:previous.id}:story?{leadId:story.id}:{}),
      });
      if(generation === targetGeneration.current) setMission(created.mission);
      const result = await api(`/api/missions/${created.mission.id}/run`, {});
      if(generation === targetGeneration.current) setMission(result.mission);
      setMissions((await api("/api/missions")).missions);
    } catch (e) {
      if(generation === targetGeneration.current) setError(e instanceof Error ? e.message : "Mission failed.");
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
  async function prepareFunding() {
    if (!mission || !wallet.address) return;
    setBusy("Preparing bounded funding request");
    setError("");
    try {
      const prepared = await api(`/api/missions/${mission.id}/chain`, {
        action: "fund",
        account: wallet.address,
      });
      setMission(prepared.mission);
      setPreparedFunding(prepared.transaction);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Funding request could not be prepared. Nothing was sent.",
      );
    } finally {
      setBusy("");
    }
  }
  async function signFunding() {
    if (!mission || !wallet.address || !preparedFunding?.policy) return;
    setBusy("Waiting for Privy wallet signature");
    setError("");
    try {
      const hash = await wallet.send(preparedFunding);
      setBusy("Verifying Arc receipt and MissionOpened event");
      const verified = await api(
        `/api/missions/${mission.id}/chain/verify`,
        {
          transactionHash: hash,
          bindingHash: preparedFunding.policy.bindingHash,
        },
      );
      setTx(hash);
      setMission(verified.mission);
      setChain(verified.chain);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Funding receipt was not verified. Mission remains inactive.",
      );
    } finally {
      setBusy("");
    }
  }
  async function reclaim() {
    if (!mission || !wallet.address) return;
    setBusy("Reclaiming budget");
    setError("");
    try {
      const prepared = await api(`/api/missions/${mission.id}/chain`, {
        action: "close",
        account: wallet.address,
      });
      const hash = await wallet.send(prepared.transaction);
      setTx(hash);
      setChain((await api(`/api/missions/${mission.id}/chain`)).chain);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Reclaim failed. No success assumed.",
      );
    } finally {
      setBusy("");
    }
  }
  async function switchWalletChain() {
    setBusy("Switching linked wallet to Arc testnet");
    setError("");
    try {
      await wallet.switchToArc();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Wallet network could not be changed.",
      );
    } finally {
      setBusy("");
    }
  }
  const allProjects = [...projects, ...(radar?.projects || [])];
  const selectedRecord = radar?.records.find(r => r.id === selected.id);
  const graphCovered = selected.contract?.toLowerCase() === projects[0].contract?.toLowerCase();
  useEffect(() => {
    if ((!graphCovered || capabilities?.graphConfigured === false) && provider === "graph") setProvider("explorer");
  }, [graphCovered, provider, selected.id, capabilities?.graphConfigured]);
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
  const coverage =
    mission?.report ? assessEvidenceCoverage(mission) : null;
  const selectedWallet = wallet.wallets.find(
    (candidate) =>
      candidate.address.toLowerCase() === wallet.address?.toLowerCase(),
  );
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
        {!researchPreview && <>
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
        </>}
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
            ) : view==="today" ? <DailyBrief data={brief} updates={updates} workers={workers} following={following} lastHunt={lastHuntReturn(missions)} onSelect={startInvestigation} onReview={reviewUpdate} onOpenChanges={()=>setView("changes")} error={briefError}/> : view==="changes" ? <FollowedChanges data={followedData} onSelect={startInvestigation} onReview={()=>void reviewChanges()} busy={followBusy}/> : (
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
                    {selectedHunter.tools.filter(t => !researchPreview || !t.includes("payment")).map((t) => (
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
                  <strong>{researchPreview ? "Research preview. Actions stay simulated." : "Research first. Capital with limits."}</strong>
                  <p>
                    {researchPreview ? "Inspect the source sample, retain its limits, and revisit it. No fee, wallet transaction or investment action occurs in this preview." : "Mission funding pays a fixed research fee. It is not an investment, a trade, or ownership of this Hunter. Strategy shares are not available."}
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
            {followNotice && <p className="setup-note" role="status">{followNotice} <button className="evidence-link" onClick={()=>setView("changes")}>Open Changes →</button></p>}
            {story && story.project.id === selected.id && <section className="selected-story" aria-label="Lead being investigated"><span className="work-kicker">YOUR LEAD</span><h3>{story.question}</h3><p>{story.finding}</p><p className="report-time">{story.whyNow}</p><details><summary>Original evidence and limits</summary><p>{story.counterevidence}</p>{story.evidence.map(e=><a key={e.id} className="evidence-link" href={e.url} target="_blank" rel="noreferrer">{e.title} ↗</a>)}</details></section>}
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
              <h3>{selected.repo ? "Want to inspect onchain activity too?" : selectedHunter.question}</h3>
              {story && selected.contract && <p className="report-time">This Hunt answers the activity part of your lead with a bounded source sample. It does not explain the contract code or verify the team.</p>}
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
                  {!graphCovered && <p className="setup-note">This target is outside the deployed Graph index. Arcscan is selected for a free preview. Graph coverage will not be implied.</p>}
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
                  <details className="research-terms"><summary>Optional research budget · no charge to run</summary><p className="report-time">These terms apply only if you later choose a separate payment or simulation action. Running this Hunt is free.</p>
                  <label>
                    {researchPreview ? "Simulation ceiling" : "Proposed mission budget"} <span>testnet USDC</span>
                    <input
                      type="number"
                      min="0.01"
                      max="10"
                      step="0.01"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                    />
                  </label>
                  {!researchPreview && <>
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
                  </>}
                  </details>
                  <button
                    className="work-primary-button"
                    disabled={Boolean(busy) || (provider === "graph" && (!graphCovered || !capabilities?.graphConfigured))}
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
                    Hunt this · free <ArrowRight size={16} />
                  </button>
                  <small className="no-charge">
                    {researchPreview ? "Research preview. No wallet, payment or transaction execution." : "No wallet charge. Review evidence before funding."}
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
            {previousReport &&
              (mission.status === "reported" ||
                mission.status === "blocked") && (
              <ReportComparison previous={previousReport} current={mission} />
            )}
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
            {mission.sourceLead && <section className="selected-story"><span className="work-kicker">THE LEAD YOU SAVED</span><h3>{mission.sourceLead.question}</h3><p>{mission.sourceLead.finding}</p><details><summary>Original source links · observed {time(mission.sourceLead.observedAt)}</summary>{mission.sourceLead.evidence.map(e=><a className="evidence-link" key={e.id} href={e.url} target="_blank" rel="noreferrer">{e.title} ↗</a>)}</details><p className="report-time">The Hunter tests the bounded activity question below. The original lead is context, not an additional verified conclusion.</p></section>}
            {mission.error && <p className="work-error">{mission.error}</p>}
            {report && (
              <>
                <div className="report-conclusion">
                  <span className="work-kicker">
                    {report.stance.replaceAll("-", " ").toUpperCase()}
                  </span>
                  <h3>{report.conclusion}</h3>
                </div>
                {coverage && (
                  <EvidenceCoveragePanel
                    assessment={coverage}
                    mission={mission}
                  />
                )}
                {report && (
                  <section className="graph-revisit-cta">
                    <div>
                      <span className="work-kicker">
                        KEEP THIS QUESTION OPEN
                      </span>
                      <h3>What would make you revisit this conclusion?</h3>
                      <p>
                        {report.provider === "graph" ? "Save this report and watch for a later Transfer event from this exact contract. A newer index or retrieval alone does not meet the condition." : "Keep this report and choose a measurable counter change to check next. The counter starts from a fresh source reading; it is not the size of this report’s sample."}
                      </p>
                    </div>
                    <Link
                      className="work-primary-button"
                      href={`/theses?project=${encodeURIComponent(mission.projectId)}&mission=${encodeURIComponent(mission.id)}`}
                    >
                      Save a revisit condition <ArrowRight size={15} />
                    </Link>
                    <button className="work-refresh work-text-button" disabled={!storageReady || followBusy} onClick={()=>void follow(mission.projectId)}>{following.includes(mission.projectId) ? "Following · remove" : "Follow this project"}</button>
                    <p className="report-time">Your report is saved. Reopen it from Today’s last investigation or Hunters. Scheduled thesis checks need a running worker.</p>
                    {followNotice && <p role="status" className="setup-note">{followNotice}</p>}
                  </section>
                )}
                <ActionProposalPanel
                  key={mission.id}
                  proposal={actionProposalFor(report, mission.address)}
                  missionId={mission.id}
                  savedReview={mission.policyReview}
                  report={report}
                  savedOpportunityReceipt={mission.opportunityReceipt}
                />
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
                {!researchPreview && <>
                <div className="funding-panel">
                  <div>
                    <h3>Approve a bounded mission.</h3>
                    <p>
                      Budget {mission.budget} testnet USDC · fixed fee{" "}
                      {mission.fee} · surplus reclaimable. An executor commits
                      the report hash to collect the fee; this is not proof that
                      the report is correct.
                    </p>
                    {coverage?.funding === "eligible" && wallet.address && (
                      <div className="selected-wallet">
                        <p>
                          Selected wallet for preparation (user-owned external vs
                          Privy embedded — choose explicitly):
                        </p>
                        <label className="opportunity-wallet-select">
                          <span>Connected account</span>
                          <select
                            value={wallet.address}
                            onChange={(event) =>
                              wallet.select(event.target.value)
                            }
                          >
                            {wallet.wallets.map((item) => (
                              <option value={item.address} key={item.address}>
                                {item.kind} · {item.address}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="report-time">
                          Using {selectedWallet?.kind ?? "linked"} ·{" "}
                          <code>{wallet.address}</code>. Preparing terms does not
                          broadcast; Sign and fund remains a separate step and is
                          not required for research review.
                        </p>
                      </div>
                    )}
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
                    {coverage?.funding === "withheld" ? (
                      <button disabled>
                        Funding withheld — {coverage.status}
                      </button>
                    ) : !wallet.address ? (
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
                          coverage?.funding !== "eligible" ||
                          Boolean(chain?.funded) ||
                          Boolean(mission.fundingReceipt)
                        }
                        onClick={() => void prepareFunding()}
                      >
                        {preparedFunding?.policy &&
                        Date.parse(preparedFunding.expiresAt) >= Date.now()
                          ? "Refresh funding terms"
                          : "Prepare exact funding terms"}
                      </button>
                    )}
                    {wallet.address && preparedFunding?.policy && (
                      <button
                        disabled={
                          Boolean(busy) ||
                          Boolean(chain?.funded) ||
                          Boolean(mission.fundingReceipt) ||
                          Date.parse(preparedFunding.expiresAt) < Date.now()
                        }
                        onClick={() => void signFunding()}
                      >
                        Sign and fund with Privy
                      </button>
                    )}
                    {wallet.address && preparedFunding?.policy && (
                      <button
                        disabled={Boolean(busy)}
                        onClick={() => void switchWalletChain()}
                      >
                        Switch wallet to Arc testnet
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
                      onClick={() => void reclaim()}
                    >
                      Cancel / reclaim surplus
                    </button>
                  </div>
                </div>
                {preparedFunding?.policy &&
                  !mission.fundingReceipt && (
                    <FundingPolicyView transaction={preparedFunding} />
                  )}
                {mission.fundingReceipt && (
                  <FundingReceiptView receipt={mission.fundingReceipt} />
                )}
                </>}
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

function EvidenceCoveragePanel({
  assessment,
  mission,
}: {
  assessment: EvidenceCoverageAssessment;
  mission: Mission;
}) {
  const retained = mission.coverageDecision;
  return (
    <section
      className={`coverage-decision ${assessment.status}`}
      aria-label="Evidence coverage decision"
    >
      <div className="list-caption">
        <span>DATA COVERAGE</span>
        <span className="coverage-status">{assessment.status}</span>
      </div>
      <h3>
        {assessment.funding === "eligible"
          ? "Evidence clears the coverage gate."
          : "Funding is withheld."}
      </h3>
      <p>{assessment.reason}</p>
      <dl className="coverage-facts">
        <div>
          <dt>Exact target</dt>
          <dd><code>{mission.address}</code></dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>{mission.report?.provider === "graph" ? "The Graph" : "Arcscan preview"}</dd>
        </div>
        <div>
          <dt>Report observed</dt>
          <dd>{mission.report?.observedAt}</dd>
        </div>
        <div>
          <dt>Current decision</dt>
          <dd>{assessment.funding} · recalculated when this mission is opened</dd>
        </div>
      </dl>
      {retained && (
        <details>
          <summary>Retained coverage receipt {retained.id}</summary>
          <p>
            {retained.funding} as {retained.status} at {retained.evaluatedAt}.
            Report commitment <code>{retained.reportHash}</code>.
          </p>
        </details>
      )}
      {assessment.neededEvidence.length > 0 && (
        <div className="coverage-requirements">
          <strong>What evidence would make this eligible</strong>
          <ol>
            {assessment.neededEvidence.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ol>
        </div>
      )}
      <p className="coverage-boundary">
        Coverage eligibility never authorizes a signature or broadcast. The
        wallet and policy checks are separate.
      </p>
    </section>
  );
}

function FundingPolicyView({
  transaction,
}: {
  transaction: PreparedMissionTransaction;
}) {
  const policy = transaction.policy;
  if (!policy) return null;
  return (
    <section className="funding-receipt prepared" aria-label="Prepared funding policy">
      <div className="list-caption">
        <span>PREPARED FUNDING POLICY</span>
        <span>signature required</span>
      </div>
      <h3>Review what the wallet will authorize.</h3>
      <dl className="policy-receipt-facts">
        <div><dt>Account</dt><dd>{policy.account}</dd></div>
        <div><dt>Target</dt><dd>{policy.target}</dd></div>
        <div><dt>Asset</dt><dd>Arc testnet native USDC</dd></div>
        <div><dt>Amount / ceiling</dt><dd>{formatEther(BigInt(policy.amount))} / {formatEther(BigInt(policy.amountCeiling))}</dd></div>
        <div><dt>Evidence</dt><dd>The Graph · block {policy.evidence.sourceBlock} · {policy.evidence.observedAt}</dd></div>
        <div><dt>Report commitment</dt><dd><code>{policy.reportHash}</code></dd></div>
        <div><dt>Action expiry</dt><dd>{policy.expiresAt}</dd></div>
        <div><dt>Policy binding</dt><dd><code>{policy.bindingHash}</code></dd></div>
      </dl>
      <p className="report-time">
        The next click opens the linked Privy wallet. A wrong account, wrong chain,
        changed calldata, stale request or failed receipt cannot activate the mission.
      </p>
    </section>
  );
}

function FundingReceiptView({ receipt }: { receipt: MissionFundingReceipt }) {
  return (
    <section className="funding-receipt active" aria-label="Verified funding receipt">
      <div className="list-caption">
        <span>VERIFIED ARC RECEIPT</span>
        <span>{receipt.status}</span>
      </div>
      <h3>Mission active.</h3>
      <p className="policy-pass">
        The successful transaction, MissionOpened event and current escrow state
        match the prepared policy.
      </p>
      <dl className="policy-receipt-facts">
        <div><dt>Transaction</dt><dd><a href={`https://testnet.arcscan.app/tx/${receipt.transactionHash}`} target="_blank" rel="noreferrer">{receipt.transactionHash}</a></dd></div>
        <div><dt>Account</dt><dd>{receipt.account}</dd></div>
        <div><dt>Amount / ceiling</dt><dd>{formatEther(BigInt(receipt.amount))} / {formatEther(BigInt(receipt.amountCeiling))} testnet USDC</dd></div>
        <div><dt>Block</dt><dd>{receipt.blockNumber} · {receipt.confirmations} confirmation{receipt.confirmations === 1 ? "" : "s"}</dd></div>
        <div><dt>Report commitment</dt><dd><code>{receipt.reportHash}</code></dd></div>
        <div><dt>Policy binding</dt><dd><code>{receipt.bindingHash}</code></dd></div>
        <div><dt>Verified</dt><dd>{receipt.verifiedAt}</dd></div>
      </dl>
    </section>
  );
}
