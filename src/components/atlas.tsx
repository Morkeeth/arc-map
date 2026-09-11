"use client";

import Link from "next/link";
import { useFollowing } from "./discovery";
import { districtFor } from "@/lib/analysis";
import { projectIdForAddress as projectIdFor } from "@/lib/browser-follows";
import type { RadarData } from "@/lib/radar-types";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Bookmark, Check, ChevronRight, Compass, ExternalLink, Focus, Layers, LoaderCircle, Map, Minus, Plus, Radio, RefreshCw, Search, Telescope, Terminal, X } from "lucide-react";
import type { District, Snapshot, Token } from "@/lib/types";

type View = "map" | "stories" | "following" | "hunters";
const DISTRICTS: District[] = ["Tokens", "Pools", "Vaults", "Assets"];
const fmt = (n: number | null) => n === null ? "Unknown" : n.toLocaleString("en-US");
const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const date = (stamp: string) => new Date(stamp).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const SUN = "0x02a0545e0f6dce7e0fb68bc4ed0e9688e29e6ee1";

function storyFor(token: Token) {
  if (token.address.toLowerCase() === SUN) return { title: "A distribution. What happened next?", question: "Is this distribution turning into activity? Start by examining the latest transfers.", tag: "Distribution" };
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
  const follows = useFollowing();
  const following = follows.following;
  const [sourceStatus, setSourceStatus] = useState("Source status unavailable");
  const [agentOpen, setAgentOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const dialogRef = useRef<HTMLDialogElement>(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/radar");
      if (!response.ok) throw new Error("Saved discovery evidence unavailable.");
      const radar: RadarData = await response.json();
      const source = radar.sources.find(s=>s.id === "token-list");
      setSourceStatus(source?.error ? "Last token-list source check failed" : source?.lastSuccess ? `Token source last checked ${date(source.lastSuccess)}${Date.now()-Date.parse(source.lastSuccess)>900000 ? " · stale" : ""}` : "No completed token source check");
      const records = radar.records.filter(r=>r.kind === "token");
      const data: Snapshot = {tokens:records.map(r=>({address:r.address,name:r.name,symbol:r.symbol||"?",holders:r.holders,district:districtFor(r.name,r.symbol||"")})),fetchedAt:records.map(r=>r.lastObservedAt).sort().at(-1) || radar.generatedAt,source:"Arcscan explorer",sourceUrl:"https://testnet.arcscan.app/tokens",coverage:radar.coverage + " Map shows retained token listings. Refresh reads saved observations; source workers collect new evidence."};
      setSnapshot(data);
      setSelected((current) => data.tokens.find((token: Token) => token.address.toLowerCase() === (current?.address.toLowerCase() ?? SUN)) ?? data.tokens[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Discovery is unavailable.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (agentOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [agentOpen]);

  const tokens = snapshot?.tokens ?? [];
  const visible = tokens.filter((token) =>
    (district === "All" || token.district === district) &&
    `${token.name} ${token.symbol} ${token.address}`.toLowerCase().includes(query.toLowerCase()) &&
    (view !== "following" || following.includes(projectIdFor(token.address)))
  );
  const tokenFollowCount = tokens.filter(token=>following.includes(projectIdFor(token.address))).length;
  const isFollowing = selected ? following.includes(projectIdFor(selected.address)) : false;
  const selectedStory = selected ? storyFor(selected) : null;

  function select(token: Token) {
    setSelected(token);
  }

  function follow() { if(selected) void follows.toggle(projectIdFor(selected.address)); }

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
          <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}><Icon size={19} strokeWidth={1.7} /><span>{label}</span>{id === "following" && tokenFollowCount > 0 && <b>{tokenFollowCount}</b>}</button>)}</nav>
          <div className="rail-note"><span className="eyebrow">EXPLORE WITH INTENT</span><p>Follow a signal.<br />Find the story.</p><div className="rail-cross">✳</div></div>
          <div className="rail-footer"><span className="live-dot" /> ARC TESTNET<br /><span>Independent field guide</span></div>
        </aside>

        <main id="workspace" className="workspace">
          <div className="page-heading"><div><div className="eyebrow"><span className="accent-line" /> AN OPEN WORLD, WORTH EXPLORING</div><h1>{view === "following" ? "Your corner of Arc." : view === "hunters" ? "Curiosity, with a mission." : view === "stories" ? "Every signal has a story." : "Find your next rabbit hole."}</h1></div><span className="edition">FIELD GUIDE<br /><strong>01 / ARC</strong></span></div>

          <p className="quiet" role="status">{sourceStatus}. Names and districts come from untrusted metadata; they do not establish issuer identity.</p>
          <section className="discovery-bar" aria-label="Discovery controls"><label className="search-box"><Search size={17} /><input aria-label="Search tokens" placeholder="Search a token, name or address" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="filters" aria-label="Filter by district">{(["All", ...DISTRICTS] as const).map((item) => <button key={item} aria-pressed={district === item} onClick={() => setDistrict(item)} className={district === item ? "selected" : ""}>{item === "All" ? "All districts" : item}</button>)}</div><button className="icon-button refresh" aria-label="Refresh discovery" disabled={loading} onClick={() => void refresh()}><RefreshCw size={17} className={loading ? "spin" : ""} /></button></section>

          {error && <div className="error-banner" role="alert">{error} {snapshot && "The previous snapshot remains visible."}<button onClick={() => void refresh()}>Retry</button></div>}

          {view === "following" && <p className="quiet">{tokenFollowCount} followed tokens are in this map’s retained catalog. Other projects and repositories appear in Changes in the full workspace. <Link href="/">Open workspace →</Link></p>}
          {view === "hunters" ? <section className="hunter-home"><div className="hunter-art"><Telescope size={82} strokeWidth={1} /><span>SCOUT / 001</span></div><div><span className="eyebrow">THE HUNT / TRANSFER SCOUT</span><h2>What are those wallets actually doing?</h2><p>Select a token and send the transfer scout. It inspects a bounded transfer sample, checks whether it spans distinct transactions, and keeps the source evidence.</p><div className="capability-tags"><span>Read only</span><span>No wallet needed</span><span>Bounded sample</span></div><button className="primary-button" onClick={() => setView("map")}>Find a story to hunt <ArrowRight size={17} /></button><p className="quiet">Hunters run fixed evidence checks. Open a target to keep its report, compare another run and save a thesis.</p></div></section> : (
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
                    return <button key={token.address} className={`map-node district-${group.toLowerCase()} ${selectedNode ? "is-selected" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => select(token)} aria-label={`Inspect ${token.symbol}`} aria-pressed={selectedNode}><span className="node-circle">{token.symbol.slice(0, 3)}{following.includes(projectIdFor(token.address)) && <span className="node-saved" />}</span><span className="node-label">{token.symbol.length > 11 ? `${token.symbol.slice(0, 10)}…` : token.symbol}</span>{selectedNode && <span className="node-callout">YOU ARE HERE <ArrowDown size={12} /></span>}</button>;
                  });
                })}
                {loading && !snapshot && <div className="map-loading"><Compass size={36} className="spin" /><strong>Unfolding the map…</strong><span>Fetching live explorer listings</span></div>}
                {!loading && visible.length === 0 && <div className="map-loading"><Search size={32} /><strong>{error ? "The map is temporarily offline." : "No tokens match this search."}</strong><span>{error ? "Refresh to reconnect to the explorer." : "Try another name or district."}</span></div>}
              </div><div className="map-coordinate">ARC / 5042002<span>ILLUSTRATIVE DISTRICTS</span></div><div className="zoom-controls"><button aria-label="Zoom in" disabled={zoom >= 1.4} onClick={() => setZoom((value) => Math.min(1.4, value + 0.1))}><Plus size={16} /></button><button aria-label="Reset map zoom" onClick={() => setZoom(1)}><Focus size={16} /></button><button aria-label="Zoom out" disabled={zoom <= 0.8} onClick={() => setZoom((value) => Math.max(0.8, value - 0.1))}><Minus size={16} /></button></div></div> : <div className="token-list">{visible.map((token) => <button key={token.address} className={`token-row ${selected?.address === token.address ? "row-selected" : ""}`} onClick={() => select(token)}><span className={`mini-token district-${token.district.toLowerCase()}`}>{token.symbol.slice(0, 2)}</span><span><strong>{view === "stories" ? storyFor(token).title : token.name}</strong><small>{token.name} · {token.district} · {short(token.address)}</small>{view === "stories" && <p className="field-question">{storyFor(token).question}</p>}</span><span>{fmt(token.holders)}<small>holders</small></span><ChevronRight size={16} /></button>)}{!loading && visible.length === 0 && <div className="empty-list"><Bookmark size={30} /><h3>{view === "following" ? "Start your field collection." : "No tokens found."}</h3><p>{view === "following" ? "Follow a token from the map. Your watchlist stays in this browser." : "Try a different search."}</p><button onClick={() => { setView("map"); setQuery(""); setDistrict("All"); }}>Explore the map <ArrowRight size={16} /></button></div>}</div>}
              <div className="map-footer"><span><span className="legend-dot assets" /> Assets</span><span><span className="legend-dot tokens" /> Tokens</span><span><span className="legend-dot pools" /> Pools</span><span><span className="legend-dot vaults" /> Vaults</span><span className="map-footnote">Map shows up to 12 tokens per Token district and 6 per other district. Field notes lists all matches. Placement is not a relationship.</span></div>
            </section>

            <aside className="story-panel" aria-label="Selected token and investigation">
              {selected && selectedStory ? <><div className="story-topline"><span className="eyebrow">FIELD NOTE</span><span className="note-number">{String(tokens.findIndex((token) => token.address === selected.address) + 1).padStart(3, "0")}</span></div><div className="story-token"><span className={`mini-token district-${selected.district.toLowerCase()}`}>{selected.symbol.slice(0, 2)}</span><div><strong>{selected.name}</strong><a href={`https://testnet.arcscan.app/token/${selected.address}`} target="_blank" rel="noreferrer">{short(selected.address)} <ArrowUpRight size={11} /></a></div><button className={`follow-button ${isFollowing ? "followed" : ""}`} onClick={follow} disabled={!follows.ready} aria-label={isFollowing ? `Unfollow ${selected.symbol}` : `Follow ${selected.symbol}`} aria-pressed={isFollowing}><Bookmark size={17} fill={isFollowing ? "currentColor" : "none"} /></button></div><span className="story-category">{selectedStory.tag}</span><h2>{selectedStory.title}</h2><p className="story-intro">{selectedStory.question}</p><div className="observation"><span className="eyebrow">OBSERVED IN THE EXPLORER</span><div><strong>{fmt(selected.holders)}</strong><span>holder addresses</span></div><p>Addresses are not people. A holder count does not establish active use.</p></div><div className="hunt-prompt"><div><Telescope size={20} /><strong>THE HUNT</strong></div><p>Send a scout to inspect recent transfers and bring back the evidence.</p><Link className="primary-button" href={`/hunters?project=${encodeURIComponent(projectIdFor(selected.address))}`}>Hunt this <ArrowUpRight size={17}/></Link><span className="hunt-caption">TRANSFER SCOUT · READ ONLY · NO SPEND</span></div>{follows.error && <p className="quiet" role="alert">Follow could not be saved. Existing follows remain unchanged.</p>}{follows.notice && <p className="quiet" role="status">{follows.notice}</p>}<div className="story-source"><Radio size={13} /><span>{snapshot ? `Latest retained observation ${date(snapshot.fetchedAt)}` : "Waiting for source"}</span></div></> : <div className="empty-story"><Compass size={32} /><h2>A story starts with a signal.</h2><p>{loading ? "The scout is unfolding the map." : "Select a token to inspect its source and start an investigation."}</p></div>}
            </aside>
          </div>)}

          <section className="bottom-strip"><div><span className="eyebrow">A FIELD GUIDE, NOT A FINISH LINE</span><p>Explore the signals. Keep the good questions.</p></div><button onClick={() => setView("following")}>Your token watchlist <span>{tokenFollowCount}</span><ArrowRight size={16} /></button></section>
          <footer className="provenance"><span>{snapshot?.coverage ?? "Discovery is loading from the Arc testnet explorer."}</span><span>ARC MAP / EARLY FIELD EDITION</span></footer>
        </main>
      </div>

      <dialog ref={dialogRef} className="agent-dialog" onCancel={() => setAgentOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setAgentOpen(false); }}><div className="dialog-content"><button className="dialog-close icon-button" aria-label="Close agent instructions" onClick={() => setAgentOpen(false)}><X size={19} /></button><Terminal size={28} /><span className="eyebrow">THE HUNT / AGENT ACCESS</span><h2>Give your agent a lead.</h2><p>Your agent can discover projects, run a read-only mission and save a thesis through POST /api/mcp. MCP research tools are connected; browser and agent workspaces are separate.</p><Link className="primary-button" href="/agents">Open agent connection guide <ArrowUpRight size={16}/></Link><p className="quiet">Local server access required. No keys, wallet signatures or funds are used by this scout.</p></div></dialog>
    </div>
  );
}
