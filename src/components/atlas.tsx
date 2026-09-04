"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Bookmark, Check, ChevronRight, Compass, ExternalLink, Focus, Layers, LoaderCircle, Map, Minus, Plus, Radio, RefreshCw, Search, Telescope, Terminal, X } from "lucide-react";
import type { District, HuntReport, Snapshot, Token } from "@/lib/types";

type View = "map" | "stories" | "following" | "hunters";
const DISTRICTS: District[] = ["Tokens", "Pools", "Vaults", "Assets"];
const fmt = (n: number | null) => n === null ? "Unknown" : n.toLocaleString("en-US");
const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const date = (stamp: string) => new Date(stamp).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const SUN = "0x02a0545e0f6dce7e0fb68bc4ed0e9688e29e6ee1";

function storyFor(token: Token) {
  if (token.address.toLowerCase() === SUN) return { title: "A hundred thousand holders. What happened next?", question: "Is this distribution turning into activity? Start by examining the latest transfers.", tag: "Distribution" };
  if (token.district === "Vaults") return { title: `What's moving around ${token.symbol}?`, question: "Inspect recent token movements before drawing conclusions about deposits or demand.", tag: "Vault activity" };
  if (token.district === "Pools") return { title: `Follow the trail behind ${token.symbol}.`, question: "Who is moving this token? A transfer sample can reveal a pattern worth investigating.", tag: "Pool tokens" };
  if (token.district === "Assets") return { title: `Where does ${token.symbol} go from here?`, question: "Look at the latest transfer sample to find recurring senders and recipients.", tag: "Money movement" };
  return { title: `${token.symbol} has a story. Start with the evidence.`, question: "Does the recent transfer sample look concentrated or spread out? Send a scout to find out.", tag: "Token discovery" };
}

function Mark({ small = false }: { small?: boolean }) {
  return <span className={`brand-mark ${small ? "small" : ""}`} aria-hidden="true"><Compass strokeWidth={1.7} /></span>;
}

export function Atlas() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState<District | "All">("All");
  const [view, setView] = useState<View>("map");
  const [selected, setSelected] = useState<Token | null>(null);
  const [following, setFollowing] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [report, setReport] = useState<HuntReport | null>(null);
  const [huntStatus, setHuntStatus] = useState<"idle" | "running" | "complete" | "error">("idle");
  const [huntError, setHuntError] = useState("");
  const [agentOpen, setAgentOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const huntId = useRef(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/discover");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSnapshot(data);
      setSelected((current) => data.tokens.find((token: Token) => token.address.toLowerCase() === (current?.address.toLowerCase() ?? SUN)) ?? data.tokens[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Discovery is unavailable.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    void refresh();
    try {
      const saved = JSON.parse(localStorage.getItem("arcmap.following.v1") ?? "[]");
      if (Array.isArray(saved)) setFollowing(saved.filter((value) => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)));
    } catch { setStorageError(true); }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem("arcmap.following.v1", JSON.stringify(following)); } catch { setStorageError(true); }
  }, [following, storageReady]);

  useEffect(() => {
    if (agentOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [agentOpen]);

  const tokens = snapshot?.tokens ?? [];
  const visible = tokens.filter((token) =>
    (district === "All" || token.district === district) &&
    `${token.name} ${token.symbol} ${token.address}`.toLowerCase().includes(query.toLowerCase()) &&
    (view !== "following" || following.includes(token.address))
  );
  const isFollowing = selected ? following.includes(selected.address) : false;
  const selectedStory = selected ? storyFor(selected) : null;

  function select(token: Token) {
    huntId.current += 1;
    setSelected(token);
    setReport(null);
    setHuntStatus("idle");
    setHuntError("");
  }

  async function runHunt() {
    if (!selected || huntStatus === "running") return;
    const id = ++huntId.current;
    setHuntStatus("running");
    setHuntError("");
    setReport(null);
    try {
      const response = await fetch(`/api/hunt?address=${encodeURIComponent(selected.address)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (id !== huntId.current) return;
      setReport(data);
      setHuntStatus("complete");
    } catch (cause) {
      if (id !== huntId.current) return;
      setHuntError(cause instanceof Error ? cause.message : "The scout could not complete its investigation.");
      setHuntStatus("error");
    }
  }

  function follow() {
    if (!selected) return;
    setFollowing((current) => current.includes(selected.address) ? current.filter((address) => address !== selected.address) : [...current, selected.address]);
  }

  const nav: { id: View; label: string; icon: typeof Map }[] = [
    { id: "map", label: "The map", icon: Map },
    { id: "stories", label: "Field notes", icon: Layers },
    { id: "following", label: "Following", icon: Bookmark },
    { id: "hunters", label: "THE HUNT", icon: Telescope },
  ];

  return (
    <div className="app-shell">
      <a href="#workspace" className="skip-link">Skip to the map</a>
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="ARC MAP home"><Mark /><span>ARC<span className="wordmark-light">MAP</span><sup>↗</sup></span></a>
        <div className="header-context"><span className="live-dot" /> THE FIELD GUIDE TO ARC <span className="header-divider" /> TESTNET</div>
        <button className="agent-button" onClick={() => setAgentOpen(true)}><Terminal size={16} /><span>Bring your agent</span><ArrowUpRight size={15} /></button>
      </header>

      <div className="app-body">
        <aside className="rail" aria-label="Main navigation">
          <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}><Icon size={19} strokeWidth={1.7} /><span>{label}</span>{id === "following" && following.length > 0 && <b>{following.length}</b>}</button>)}</nav>
          <div className="rail-note"><span className="eyebrow">EXPLORE WITH INTENT</span><p>Follow a signal.<br />Find the story.</p><div className="rail-cross">✳</div></div>
          <div className="rail-footer"><span className="live-dot" /> ARC TESTNET<br /><span>Independent field guide</span></div>
        </aside>

        <main id="workspace" className="workspace">
          <div className="page-heading"><div><div className="eyebrow"><span className="accent-line" /> AN OPEN WORLD, WORTH EXPLORING</div><h1>{view === "following" ? "Your corner of Arc." : view === "hunters" ? "Curiosity, with a mission." : view === "stories" ? "Every signal has a story." : "Find your next rabbit hole."}</h1></div><span className="edition">FIELD GUIDE<br /><strong>01 / ARC</strong></span></div>

          <section className="discovery-bar" aria-label="Discovery controls"><label className="search-box"><Search size={17} /><input aria-label="Search tokens" placeholder="Search a token, name or address" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="filters" aria-label="Filter by district">{(["All", ...DISTRICTS] as const).map((item) => <button key={item} aria-pressed={district === item} onClick={() => setDistrict(item)} className={district === item ? "selected" : ""}>{item === "All" ? "All districts" : item}</button>)}</div><button className="icon-button refresh" aria-label="Refresh discovery" disabled={loading} onClick={() => void refresh()}><RefreshCw size={17} className={loading ? "spin" : ""} /></button></section>

          {error && <div className="error-banner" role="alert">{error} {snapshot && "The previous snapshot remains visible."}<button onClick={() => void refresh()}>Retry</button></div>}

          {view === "hunters" ? <section className="hunter-home"><div className="hunter-art"><Telescope size={82} strokeWidth={1} /><span>SCOUT / 001</span></div><div><span className="eyebrow">THE HUNT / TRANSFER SCOUT</span><h2>What are those wallets actually doing?</h2><p>Select a token and send the transfer scout. It checks the latest explorer sample, identifies repeated senders, and brings back the source transactions.</p><div className="capability-tags"><span>Read only</span><span>No wallet needed</span><span>Bounded sample</span></div><button className="primary-button" onClick={() => setView("map")}>Find a story to hunt <ArrowRight size={17} /></button><p className="quiet">Autonomous agents and funded missions are next. This first scout runs a fixed evidence check.</p></div></section> : (
          <div className="explorer-grid">
            <section className="map-section" aria-label={view === "map" ? "Token atlas" : "Token discovery list"}>
              <div className="map-toolbar"><div><span className="live-dot" /><strong>{view === "following" ? "YOUR WATCHLIST" : view === "stories" ? "FROM THE FIELD" : "THE EXPLORER"}</strong><span>{loading ? "Fetching source…" : `${visible.length} matching tokens`}</span></div><span className="map-source">{snapshot?.source ?? "Connecting"}</span></div>
              {view === "map" ? <div className="map-viewport"><div className="map-grid" style={{ transform: `scale(${zoom})` }}>
                <div className="district-label label-assets"><span>01</span> THE RESERVE</div><div className="district-label label-tokens"><span>02</span> TOKEN TERRITORY</div><div className="district-label label-pools"><span>03</span> LIQUIDITY QUARTER</div><div className="district-label label-vaults"><span>04</span> THE VAULTS</div>
                <div className="map-axis horizontal" /><div className="map-axis vertical" />
                {DISTRICTS.map((group) => {
                  const members = visible.filter((token) => token.district === group).slice(0, group === "Tokens" ? 12 : 6);
                  const positions: Record<District, { x: number; y: number; width: number; cols: number }> = { Assets: { x: 10, y: 18, width: 29, cols: 3 }, Tokens: { x: 51, y: 18, width: 39, cols: 4 }, Pools: { x: 7, y: 64, width: 39, cols: 4 }, Vaults: { x: 62, y: 65, width: 25, cols: 3 } };
                  const layout = positions[group];
                  return members.map((token, index) => {
                    const x = layout.x + (index % layout.cols) * (layout.width / (layout.cols - 1));
                    const y = layout.y + Math.floor(index / layout.cols) * 13 + (index % 2 === 1 ? 3 : 0);
                    const selectedNode = selected?.address === token.address;
                    return <button key={token.address} className={`map-node district-${group.toLowerCase()} ${selectedNode ? "is-selected" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => select(token)} aria-label={`Inspect ${token.symbol}`} aria-pressed={selectedNode}><span className="node-circle">{token.symbol.slice(0, 3)}{following.includes(token.address) && <span className="node-saved" />}</span><span className="node-label">{token.symbol.length > 11 ? `${token.symbol.slice(0, 10)}…` : token.symbol}</span>{selectedNode && <span className="node-callout">YOU ARE HERE <ArrowDown size={12} /></span>}</button>;
                  });
                })}
                {loading && !snapshot && <div className="map-loading"><Compass size={36} className="spin" /><strong>Unfolding the map…</strong><span>Fetching live explorer listings</span></div>}
                {!loading && visible.length === 0 && <div className="map-loading"><Search size={32} /><strong>{error ? "The map is temporarily offline." : "No tokens match this search."}</strong><span>{error ? "Refresh to reconnect to the explorer." : "Try another name or district."}</span></div>}
              </div><div className="map-coordinate">ARC / 5042002<span>ILLUSTRATIVE DISTRICTS</span></div><div className="zoom-controls"><button aria-label="Zoom in" disabled={zoom >= 1.4} onClick={() => setZoom((value) => Math.min(1.4, value + 0.1))}><Plus size={16} /></button><button aria-label="Reset map zoom" onClick={() => setZoom(1)}><Focus size={16} /></button><button aria-label="Zoom out" disabled={zoom <= 0.8} onClick={() => setZoom((value) => Math.max(0.8, value - 0.1))}><Minus size={16} /></button></div></div> : <div className="token-list">{visible.map((token) => <button key={token.address} className={`token-row ${selected?.address === token.address ? "row-selected" : ""}`} onClick={() => select(token)}><span className={`mini-token district-${token.district.toLowerCase()}`}>{token.symbol.slice(0, 2)}</span><span><strong>{view === "stories" ? storyFor(token).title : token.name}</strong><small>{token.name} · {token.district} · {short(token.address)}</small>{view === "stories" && <p className="field-question">{storyFor(token).question}</p>}</span><span>{fmt(token.holders)}<small>holders</small></span><ChevronRight size={16} /></button>)}{!loading && visible.length === 0 && <div className="empty-list"><Bookmark size={30} /><h3>{view === "following" ? "Start your field collection." : "No tokens found."}</h3><p>{view === "following" ? "Follow a token from the map. Your watchlist stays in this browser." : "Try a different search."}</p><button onClick={() => { setView("map"); setQuery(""); setDistrict("All"); }}>Explore the map <ArrowRight size={16} /></button></div>}</div>}
              <div className="map-footer"><span><span className="legend-dot assets" /> Assets</span><span><span className="legend-dot tokens" /> Tokens</span><span><span className="legend-dot pools" /> Pools</span><span><span className="legend-dot vaults" /> Vaults</span><span className="map-footnote">Map shows up to 12 tokens per Token district and 6 per other district. Field notes lists all matches. Placement is not a relationship.</span></div>
            </section>

            <aside className="story-panel" aria-label="Selected token and investigation">
              {selected && selectedStory ? <><div className="story-topline"><span className="eyebrow">FIELD NOTE</span><span className="note-number">{String(tokens.findIndex((token) => token.address === selected.address) + 1).padStart(3, "0")}</span></div><div className="story-token"><span className={`mini-token district-${selected.district.toLowerCase()}`}>{selected.symbol.slice(0, 2)}</span><div><strong>{selected.name}</strong><a href={`https://testnet.arcscan.app/token/${selected.address}`} target="_blank" rel="noreferrer">{short(selected.address)} <ArrowUpRight size={11} /></a></div><button className={`follow-button ${isFollowing ? "followed" : ""}`} onClick={follow} aria-label={isFollowing ? `Unfollow ${selected.symbol}` : `Follow ${selected.symbol}`} aria-pressed={isFollowing}><Bookmark size={17} fill={isFollowing ? "currentColor" : "none"} /></button></div><span className="story-category">{selectedStory.tag}</span><h2>{selectedStory.title}</h2><p className="story-intro">{selectedStory.question}</p><div className="observation"><span className="eyebrow">OBSERVED IN THE EXPLORER</span><div><strong>{fmt(selected.holders)}</strong><span>holder addresses</span></div><p>Addresses are not people. A holder count does not establish active use.</p></div><div className="hunt-prompt"><div><Telescope size={20} /><strong>THE HUNT</strong></div><p>Send a scout to inspect recent transfers and bring back the evidence.</p><button className="primary-button" disabled={huntStatus === "running"} onClick={() => void runHunt()}>{huntStatus === "running" ? <><LoaderCircle className="spin" size={17} /> Scouting the source…</> : <>Hunt this <ArrowUpRight size={17} /></>}</button><span className="hunt-caption">TRANSFER SCOUT · READ ONLY · NO SPEND</span></div>{huntStatus === "error" && <p className="hunt-error" role="alert">{huntError}</p>}{storageError && <p className="quiet">Browser storage is unavailable. Follows will last for this visit only.</p>}<div className="story-source"><Radio size={13} /><span>{snapshot ? `Fetched ${date(snapshot.fetchedAt)}` : "Waiting for source"}</span></div></> : <div className="empty-story"><Compass size={32} /><h2>A story starts with a signal.</h2><p>{loading ? "The scout is unfolding the map." : "Select a token to inspect its source and start an investigation."}</p></div>}
            </aside>
          </div>)}

          {report && <section className="hunt-report" aria-label="Scout findings" aria-live="polite"><div className="report-heading"><div><span className="eyebrow"><Check size={13} /> SCOUT RETURNED</span><h2>The evidence, so far.</h2></div><span>{date(report.fetchedAt)}</span></div><div className="report-metrics"><div><strong>{fmt(report.examined)}</strong><span>events examined</span></div><div><strong>{fmt(report.uniqueSenders)}</strong><span>sender addresses</span></div><div><strong>{fmt(report.uniqueRecipients)}</strong><span>recipient addresses</span></div><div><strong>{report.moreAvailable ? "Partial" : "Returned page"}</strong><span>source coverage</span></div></div><div className="report-columns"><div><h3>What the scout observed</h3>{report.observations.map((observation) => <p key={observation}>{observation}</p>)}{report.newestTransferAt && <p>Latest sampled transfer: <strong>{date(report.newestTransferAt)}</strong>. Retrieval time is not transaction time.</p>}<p className="report-limitation">{report.limitation}</p></div><div><h3>Check the trail</h3>{report.evidence.slice(0, 4).map((transfer) => <a className="evidence-row" key={`${transfer.transaction}:${transfer.logIndex}`} href={`https://testnet.arcscan.app/tx/${transfer.transaction}`} target="_blank" rel="noreferrer"><span>{short(transfer.from)} <ArrowRight size={12} /> {short(transfer.to)}<small>Block {transfer.block.toLocaleString("en-US")} · event {transfer.logIndex}</small></span><ExternalLink size={13} /></a>)}<a className="source-link" href={report.source} target="_blank" rel="noreferrer">Open the source response <ArrowUpRight size={13} /></a></div></div></section>}

          <section className="bottom-strip"><div><span className="eyebrow">A FIELD GUIDE, NOT A FINISH LINE</span><p>Explore the signals. Keep the good questions.</p></div><button onClick={() => setView("following")}>Your watchlist <span>{following.length}</span><ArrowRight size={16} /></button></section>
          <footer className="provenance"><span>{snapshot?.coverage ?? "Discovery is loading from the Arc testnet explorer."}</span><span>ARC MAP / EARLY FIELD EDITION</span></footer>
        </main>
      </div>

      <dialog ref={dialogRef} className="agent-dialog" onCancel={() => setAgentOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setAgentOpen(false); }}><div className="dialog-content"><button className="dialog-close icon-button" aria-label="Close agent instructions" onClick={() => setAgentOpen(false)}><X size={19} /></button><Terminal size={28} /><span className="eyebrow">THE HUNT / AGENT ACCESS</span><h2>Give your agent a lead.</h2><p>This local edition exposes a read-only HTTP scout. Your agent can inspect a token and receive the same source-backed report shown here. MCP and funded missions are planned.</p><pre>{`GET /api/hunt?address=${selected?.address ?? "<token-address>"}`}</pre><button className="primary-button" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/api/hunt?address=${selected?.address ?? "<token-address>"}`); setCopied(true); } catch { setCopied(false); } }}>{copied ? <><Check size={16} /> Copied scout URL</> : <>Copy scout URL <ArrowUpRight size={16} /></>}</button><p className="quiet">Local server access required. No keys, wallet signatures or funds are used by this scout.</p></div></dialog>
    </div>
  );
}
