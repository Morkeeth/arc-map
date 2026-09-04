import { FollowStore } from "./follow-store";
import { FeedStore } from "./feed-store";
import { RadarStore } from "./radar-store";
import { researchProject } from "./research-catalog";
import type { FeedEvent } from "./feed-types";

export function followedChanges(owner: string) {
  const follows=new FollowStore(), feed=new FeedStore(), radar=new RadarStore();
  try {
    const list=follows.list(owner), position=follows.position(owner);
    const head={feed:feed.eventHead(),radar:radar.eventHead()};
    const baseline=position || {...head,reviewedAt:null};
    if(baseline.feed>head.feed || baseline.radar>head.radar)throw new Error("Source history is behind the saved review. Restore matching data before advancing.");
    const feedRows=feed.eventsAfter(baseline.feed,head.feed), radarRows=radar.eventsAfter(baseline.radar,head.radar);
    const through={feed:feedRows.length>200?feedRows[199].sequence:head.feed,radar:radarRows.length>200?radarRows[199].sequence:head.radar};
    const followed=new Map(list.map(f=>[f.projectId,f]));
    const events:FeedEvent[]=feedRows.slice(0,200).filter(r=>r.sequence>(followed.get(r.event.projectId)?.feed??Infinity)).map(r=>r.event);
    for(const row of radarRows.slice(0,200)) {
      const e=row.event, projectId=`arc:${e.address.toLowerCase()}`;
      if(row.sequence<=(followed.get(projectId)?.radar??Infinity))continue;
      events.push({id:e.id,projectId,kind:e.source==="verification"?"code":"onchain",title:e.title,
        detail:e.source==="token-list"?`${e.holders===null?"Unknown":e.holders.toLocaleString("en-US")} holder addresses reported. This is not a count of people.`:e.source==="verification"?"Source-code verification was observed. It is not proof of deployment time, safety or affiliation.":"A successful transaction appears in the bounded source page. It is not a measure of economic demand.",
        sourceUrl:e.sourceUrl,observedAt:e.observedAt,eventAt:e.eventAt,baselineAt:null});
    }
    return {follows:list,projects:list.map(f=>researchProject(f.projectId)).filter(Boolean),reviewedAt:baseline.reviewedAt,
      generatedAt:new Date().toISOString(),ticket:follows.ticket(owner,through),moreAvailable:feedRows.length>200||radarRows.length>200,
      events:events.sort((a,b)=>b.observedAt.localeCompare(a.observedAt)),sources:{feed:feed.health(),radar:radar.health()},
      coverage:"Changes recorded since your last acknowledged review, for projects followed at that time. Each source page is bounded. Newly observed does not mean newly happened. Reading or refreshing does not mark changes reviewed."};
  } finally {follows.close();feed.close();radar.close();}
}
export function changeFollow(owner:string,input:Record<string,unknown>) {
  const store=new FollowStore();
  try {
    if(input.action==="review") {
      if(typeof input.ticket!=="string")throw new Error("A saved review window is required.");
      store.acknowledge(owner,input.ticket); return;
    }
    const project=researchProject(input.projectId);
    if(!project)throw new Error("Choose a sourced project.");
    if(input.action==="unfollow") {store.unfollow(owner,project.id);return;}
    if(input.action!=="follow")throw new Error("Choose follow, unfollow or review.");
    const feed=new FeedStore(),radar=new RadarStore();
    try {store.follow(owner,project.id,{feed:feed.eventHead(),radar:radar.eventHead()});}
    finally {feed.close();radar.close();}
  } finally {store.close();}
}
