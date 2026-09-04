"use client";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/lib/projects";
import type { FeedEvent, SourceHealth } from "@/lib/feed-types";
import type { Follow } from "@/lib/follow-store";
export type FollowedData = {
  follows: Follow[]; projects: Project[]; reviewedAt: string | null; generatedAt: string;
  ticket: string; moreAvailable: boolean; events: FeedEvent[]; coverage: string;
  sources: { feed: SourceHealth[]; radar: { id: string; lastSuccess: string | null; error: string | null }[] };
};
const date=(value:string)=>new Date(value).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
export function FollowedChanges({data,onSelect,onReview,busy}:{data:FollowedData|null;onSelect:(p:Project)=>void;onReview:()=>void;busy:boolean}) {
  if(!data)return <p className="work-empty">Loading your saved follows and review baseline…</p>;
  const stale=[...data.sources.feed,...data.sources.radar].filter(s=>s.error || !s.lastSuccess || Date.parse(data.generatedAt)-Date.parse(s.lastSuccess)>15*60000);
  return <div className="followed-changes">
    <div className="list-caption"><span>SINCE YOUR LAST REVIEW</span><span>{data.events.length} recorded changes</span></div>
    <p className="thesis-rule">{data.reviewedAt?`Baseline ${date(data.reviewedAt)}. Refreshing keeps this baseline fixed.`:"Follow a project to start a review baseline. Earlier source history remains in Discover."}</p>
    {stale.length>0 && <p className="setup-note">{stale.length} source checks are stale or unavailable. A quiet inbox does not establish inactivity.</p>}
    <div className="followed-projects">{data.projects.map(p=><button key={p.id} className="work-refresh work-text-button" onClick={()=>onSelect(p)}>{p.name}</button>)}</div>
    {!data.follows.length?<p className="work-empty">Follow projects in Discover. Return here to inspect what was recorded next.</p>:!data.events.length?<p className="work-empty">No new changes recorded in this review window. That is not proof that nothing happened onchain.</p>:data.events.map(e=>{
      const p=data.projects.find(p=>p.id===e.projectId);
      return <article className="work-event" key={e.id}><div><div className="event-meta"><button onClick={()=>p&&onSelect(p)}>{p?.name||e.projectId}</button><span>{e.kind}</span></div>
        <a href={e.sourceUrl} target="_blank" rel="noreferrer"><h2>{e.title}<ArrowUpRight size={14}/></h2></a><p>{e.detail}</p>
        <small>Recorded {date(e.observedAt)} · {e.eventAt?`Source event ${date(e.eventAt)}`:"Source event time unavailable"}</small>
      </div></article>;
    })}
    {data.follows.length>0 && <button className="work-refresh work-text-button" onClick={onReview} disabled={busy}>{busy?"Saving review…":"Mark this window reviewed"}</button>}
    {data.moreAvailable&&<p className="setup-note">More recorded history remains. Review this window to load the next one; later records will not be skipped.</p>}
    <p className="report-time">{data.coverage}</p><p className="report-time">Follows persist in this private browser workspace on the server. Clearing its cookie loses access; this is not cross-device account sync.</p>
  </div>;
}
