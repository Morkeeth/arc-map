"use client";
import Link from "next/link";
import { useState } from "react";
import type { DailyBrief as BriefData } from "@/lib/daily-brief";
import type { ResearchUpdate } from "@/lib/research-updates";
import type { Project } from "@/lib/projects";
const time=(at:string)=>new Date(at).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
export function DailyBrief({data,updates,onSelect,onReview,error}:{data:BriefData|null;updates:ResearchUpdate[]|null;onSelect:(p:Project)=>void;onReview:(id:string)=>Promise<void>;error:string|null}){
  const [filter,setFilter]=useState("All leads"),[limit,setLimit]=useState(6),[pending,setPending]=useState("");
  const unread=updates?.filter(u=>!u.read)||[];
  const cards=data?.cards.filter(c=>filter==="All leads"||filter==="Onchain"&&["activity","counter-change"].includes(c.kind)||filter==="Code"&&c.kind==="code"||filter==="Discovery"&&["listing","baseline"].includes(c.kind))||[];
  return <div className="daily-brief">
    <section className="research-inbox" aria-label="Research inbox"><div className="list-caption"><span>YOUR RESEARCH INBOX</span><span>{updates===null?"Loading…":`${unread.length} unread`}</span></div>
      {error&&<p className="work-error" role="alert">{error}</p>}
      {updates!==null&&!unread.length&&<p className="report-time">No unread research updates. Unchanged checks stay in each thesis’s history.</p>}
      {unread.slice(0,5).map(u=><article className="research-update" key={u.id}><span className="work-kicker">{u.projectName} · {time(u.at)}</span><h3>{u.title}</h3><p>{u.detail}</p><div className="brief-actions"><Link className="evidence-link" href={`/theses?id=${encodeURIComponent(u.thesisId)}`}>Open thesis →</Link><button className="work-refresh work-text-button" disabled={Boolean(pending)} onClick={async()=>{setPending(u.id);try{await onReview(u.id);}finally{setPending("");}}}>Mark reviewed</button></div></article>)}
      {unread.length>5&&<p className="report-time">Review these to show the next {unread.length-5} unread updates.</p>}
      <Link className="evidence-link" href="/theses">All monitored questions →</Link>
    </section>
    <div className="list-caption"><span>LEADS TO INVESTIGATE</span><span>{cards.length} grouped leads</span></div>
    <p className="brief-intro">What the sources show. Why it may matter. What they do not prove.</p>
    <div className="work-tabs" role="group" aria-label="Brief filters">{["All leads","Onchain","Code","Discovery"].map(f=><button key={f} aria-pressed={filter===f} onClick={()=>{setFilter(f);setLimit(6);}}>{f}</button>)}</div>
    {!data?<p className="work-empty">Loading the source brief…</p>:!cards.length?<p className="work-empty">No retained observations match this view in the last 24 hours. Check source coverage below; this is not proof of inactivity.</p>:cards.slice(0,limit).map(c=><article className="brief-card" key={c.id}>
      <div className="brief-meta"><span className="work-kicker">{c.kind.replaceAll("-"," ")}</span><span className={`brief-source ${c.sourceStatus}`}>{c.sourceStatus==="fresh"?"Source recently checked":`Source ${c.sourceStatus}`}</span></div>
      <h2>{c.headline}</h2>{c.project.contract&&<p className="report-time">Contract {c.project.contract.slice(0,8)}…{c.project.contract.slice(-6)}</p>}<p className="brief-finding">{c.finding}</p>
      <p className="brief-why"><strong>Why investigate</strong> {c.whyInvestigate}</p>
      <p className="brief-counter"><strong>Keep in mind</strong> {c.counterevidence}</p>
      <p className="report-time">Observed {time(c.observedAt)} · {c.firstEventAt?`Source events ${time(c.firstEventAt)}${c.lastEventAt!==c.firstEventAt?` → ${time(c.lastEventAt!)}`:""}`:"Source event time unknown"}</p>
      <div className="brief-actions"><button className="work-primary-button" onClick={()=>onSelect(c.project)}>Hunt this →</button><Link className="evidence-link" href={`/theses?project=${encodeURIComponent(c.project.id)}`}>Track a question</Link></div>
      <details><summary>Evidence and why this is shown</summary><p className="report-time">{c.rankReason} {c.observations} distinct retained observation records; up to six source links shown.</p>{c.evidence.map(e=><a className="evidence-link" key={e.id} href={e.url} target="_blank" rel="noreferrer">{e.title} ↗</a>)}</details>
    </article>)}
    {cards.length>limit&&<button className="work-refresh work-text-button" onClick={()=>setLimit(n=>n+6)}>Show six more leads</button>}
    {data&&<details className="brief-coverage"><summary>Coverage, source health and ranking</summary><p>{data.coverage}</p><p>{data.ranking}</p><p>Prepared {time(data.generatedAt)} from records observed since {time(data.since)}.</p>{data.sourceHealth.map(s=><p className="report-time" key={s.sourceId}>{s.sourceId}: {s.error?"last attempt failed":s.lastSuccess?`last success ${time(s.lastSuccess)}`:"no successful observation"}</p>)}</details>}
  </div>;
}
