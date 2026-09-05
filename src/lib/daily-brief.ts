import { createHash } from "node:crypto";
import { FeedStore } from "./feed-store";
import { RadarStore } from "./radar-store";
import { projects,type Project } from "./projects";
import { radarProject } from "./research-catalog";
import type { FeedEvent,SourceHealth } from "./feed-types";
import type { RadarEvent,RadarRecord } from "./radar-types";

export type BriefEvidence={id:string;title:string;url:string;observedAt:string;eventAt:string|null};
export type BriefCard={
  id:string;project:Project;kind:"counter-change"|"activity"|"code"|"listing"|"baseline";
  headline:string;finding:string;whyInvestigate:string;counterevidence:string;question:string;
  evidence:BriefEvidence[];observations:number;observedAt:string;firstEventAt:string|null;lastEventAt:string|null;
  sourceStatus:"fresh"|"stale"|"unavailable"|"unknown";rankReason:string;
};
export type DailyBrief={generatedAt:string;since:string;cards:BriefCard[];coverage:string;ranking:string;sourceHealth:SourceHealth[];inputRecords:number};
type Entry={project:Project;kind:BriefCard["kind"];sourceId:string;evidence:BriefEvidence;detail:string};
export function buildDailyBrief(input:{feed:FeedEvent[];radar:RadarEvent[];records:RadarRecord[];health:SourceHealth[]},now=Date.now()):DailyBrief {
  const since=new Date(now-86400000).toISOString(),entries:Entry[]=[];
  const known=new Map(projects.map(p=>[p.id,p])),byAddress=new Map(projects.filter(p=>p.contract).map(p=>[p.contract!.toLowerCase(),p]));
  const observed=new Map(input.records.map(r=>[r.address.toLowerCase(),radarProject(r)]));
  const within=(at:string)=>Number.isFinite(Date.parse(at))&&Date.parse(at)>=now-86400000&&Date.parse(at)<=now;
  for(const e of input.feed){const p=known.get(e.projectId);if(!p||!within(e.observedAt))continue;
    entries.push({project:p,kind:e.kind==="baseline"?"baseline":e.kind==="code"?"code":"counter-change",sourceId:p.repo?`github:${p.repo}`:`arc-testnet:${p.contract?.toLowerCase()}`,
      evidence:{id:e.id,title:e.title,url:e.sourceUrl,observedAt:e.observedAt,eventAt:e.eventAt},detail:e.detail});
  }
  for(const e of input.radar){if(!within(e.observedAt))continue;const p=byAddress.get(e.address.toLowerCase())||observed.get(e.address.toLowerCase());if(!p)continue;
    entries.push({project:p,kind:e.source==="transaction"?"activity":e.source==="verification"?"code":"listing",sourceId:`radar:${e.source}`,
      evidence:{id:e.id,title:e.title,url:e.sourceUrl,observedAt:e.observedAt,eventAt:e.eventAt},detail:e.title});
  }
  const grouped=new Map<string,Entry[]>();
  for(const e of entries){const key=`${e.project.id}:${e.kind}`;const group=grouped.get(key)||[];if(!group.some(x=>x.evidence.id===e.evidence.id))group.push(e);grouped.set(key,group);}
  const cards:BriefCard[]=[];
  for(const [key,group] of grouped){
    group.sort((a,b)=>b.evidence.observedAt.localeCompare(a.evidence.observedAt)||a.evidence.id.localeCompare(b.evidence.id));
    const first=group[0],p=first.project,kind=first.kind;
    const evidence=[...new Map(group.map(e=>[e.evidence.url,e.evidence])).values()];
    const events=group.map(e=>e.evidence.eventAt).filter((v):v is string=>v!==null&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=now).sort();
    const statuses=[...new Set(group.map(e=>e.sourceId))].map(id=>{
      const h=input.health.find(h=>h.sourceId===id);const checked=h?.lastSuccess?Date.parse(h.lastSuccess):NaN;return !h?"unknown":h.error?"unavailable":!Number.isFinite(checked)||checked>now||now-checked>900000?"stale":"fresh";
    });
    const sourceStatus=statuses.includes("unavailable")?"unavailable":statuses.includes("stale")?"stale":statuses.includes("unknown")?"unknown":"fresh";
    let headline:string,finding:string,whyInvestigate:string,counterevidence:string,question:string,rankReason:string;
    if(kind==="activity"){
      headline=`${p.name}: ${evidence.length} sampled transaction${evidence.length===1?"":"s"}`;
      finding=`${evidence.length} distinct transaction link${evidence.length===1?" appears":"s appear"} in retained source observations. These are sampled calls, not a full-day total.`;
      whyInvestigate="A lead for checking whether this contract has activity beyond a single interaction.";
      counterevidence="Calls can be tests or repeated automation. They do not establish unique users, economic demand or safety.";
      question="Does the sampled contract activity extend beyond one successful call?";
      rankReason=evidence.length>1?"Multiple distinct sampled transaction links; then most recently observed.":"A sampled transaction; then most recently observed.";
    }else if(kind==="counter-change"){
      headline=`${p.name}: the source counters changed`;finding=first.detail;
      whyInvestigate="A measured change provides a specific question to test against transfer evidence.";
      counterevidence="Counter changes are not active people; source corrections and distribution activity remain possible.";
      question=p.question;rankReason="A recorded counter change against a prior observation.";
    }else if(kind==="code"){
      headline=p.repo?`${p.name}: inspect the code trail`:`${p.name}: source code surfaced`;
      finding=p.repo?`Latest retained commit: ${first.evidence.title}`:"Arcscan recorded a source-code verification for this address.";
      whyInvestigate=p.repo?"Compare the code claim with an exact published release before assuming deployment.":"Published contract source gives you something concrete to inspect.";
      counterevidence="Source work or verification is not proof of deployment time, affiliation, security or adoption.";
      question=p.repo?"Does the claimed version have a published release?":"What does the sourced contract do, and is it being called?";
      rankReason="Source evidence is available for inspection; then most recently observed.";
    }else{
      headline=kind==="baseline"?`${p.name}: a baseline, not a launch`:`${p.name}: a listing worth checking`;
      finding=first.detail;whyInvestigate="Use this observation as the start of a question, then collect a later comparison.";
      counterevidence="A listing or first observation does not establish launch time, legitimacy or continued use.";
      question=p.question;rankReason="Discovery context after measured changes and source evidence.";
    }
    cards.push({id:createHash("sha256").update(JSON.stringify([key,group.map(e=>e.evidence.id).sort()])).digest("hex"),project:p,kind,headline,finding,whyInvestigate,counterevidence,question,
      evidence:evidence.slice(0,6),observations:group.length,observedAt:first.evidence.observedAt,firstEventAt:events[0]||null,lastEventAt:events.at(-1)||null,sourceStatus,rankReason});
  }
  const tier=(c:BriefCard)=>c.kind==="counter-change"?0:c.kind==="activity"&&c.evidence.length>1?1:c.kind==="code"?2:c.kind==="activity"?3:4;
  cards.sort((a,b)=>tier(a)-tier(b)||b.observedAt.localeCompare(a.observedAt)||a.id.localeCompare(b.id));
  return {generatedAt:new Date(now).toISOString(),since,cards,
    inputRecords:input.feed.length+input.radar.length,sourceHealth:input.health,
    ranking:"Editorial order: recorded counter changes, multiple sampled transactions, code evidence, single sampled transactions, then discovery context. Within each group: latest observation. Not a quality, safety or investment score.",
    coverage:"Groups up to 200 retained curated events and 200 radar events observed in the last 24 hours. Not all events from that day. Up to six source links per lead; older source events keep their original dates. Freshness policy: last source success within 15 minutes. Rules-based summaries, not AI-generated facts."};
}
export function dailyBrief(){const feed=new FeedStore(),radar=new RadarStore();try{
  return buildDailyBrief({feed:feed.events(),radar:radar.events(),records:radar.list(),health:[...feed.health(),...radar.health().map(h=>({...h,sourceId:`radar:${h.id}`}))]});
}finally{feed.close();radar.close();}}
