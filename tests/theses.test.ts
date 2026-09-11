import test from "node:test";
import assert from "node:assert/strict";
import { ThesisStore } from "../src/lib/thesis-store";
import {
  evaluateThesis,
  graphThesisBaselineFromReport,
} from "../src/lib/thesis-evidence";
import type { ThesisSample } from "../src/lib/thesis-types";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MissionStore } from "../src/lib/mission-store";
import type { MissionReport } from "../src/lib/hunters";
import { describeThesisCriterion } from "../src/lib/thesis-types";
const now=Date.parse("2026-09-05T00:00:00Z");
const baseline:ThesisSample={metric:"transfer-counter",observedAt:new Date(now).toISOString(),sourceUrl:"https://testnet.arcscan.app",value:100,sourceEventAt:null};
const input={projectId:"sun-token",claim:"The transfer counter will rise by ten.",metric:"transfer-counter",threshold:10,hours:8,checks:3,intervalMinutes:30};
test("research attachments preserve criterion and report commitment with owner and target checks",()=>{
  const store=new ThesisStore(":memory:"),missions=new MissionStore(":memory:");
  try {
    const t=store.create("a",input,baseline,now);
    const m=missions.create("a",{projectId:"sun-token",provider:"explorer",budget:"0.05"});missions.claim("a",m.id);
    const report:MissionReport={version:1,hunter:m.hunterId,thesis:m.thesis,conclusion:"Bounded research fixture.",stance:"not-supported",provider:"explorer",source:"test",observedAt:new Date(now).toISOString(),indexedBlock:null,sampleSize:1,transactions:1,firstEventAt:null,lastEventAt:null,evidence:[],observations:[],limitations:[],steps:[]};
    const complete=missions.finish("a",m.id,report,null);
    const attached=store.attachResearch("a",t.id,m.id,missions);
    assert.equal(attached[0].reportHash,complete.reportHash);
    assert.equal(store.attachResearch("a",t.id,m.id,missions).length,1);
    assert.equal(store.get("a",t.id)?.commitment,t.commitment);
    assert.equal(store.get("a",t.id)?.status,"tracking");
    assert.equal(store.get("a",t.id)?.remainingChecks,3);
    const other=store.create("b",input,baseline,now);
    assert.throws(()=>store.attachResearch("b",other.id,m.id,missions),/your completed/);
    assert.throws(()=>store.research("b",t.id),/not found/);
    const repo=store.create("a",{...input,projectId:"arc-node",metric:"repository-head"},{...baseline,metric:"repository-head",value:"a".repeat(40)},now);
    assert.throws(()=>store.attachResearch("a",repo.id,m.id,missions),/sourced contract/);
  }finally{store.close();missions.close();}
});
test("Graph Transfer thesis ignores index time alone and resolves on a later event identity",()=>{
  const store=new ThesisStore(":memory:");
  try {
    const graphReport:MissionReport={
      version:1,hunter:"distribution",thesis:"Does activity extend beyond one transaction?",conclusion:"Bounded Graph fixture.",stance:"limited-support",provider:"graph",source:"Labeled Graph fixture",observedAt:new Date(now).toISOString(),indexedBlock:500,sampleSize:2,transactions:2,firstEventAt:"2026-09-04T23:58:00Z",lastEventAt:"2026-09-04T23:59:00Z",
      evidence:[{transaction:`0x${"1".repeat(64)}`,block:490,from:`0x${"2".repeat(40)}`,to:`0x${"3".repeat(40)}`,timestamp:"2026-09-04T23:59:00Z",logIndex:4}],observations:[],limitations:["Labeled fixture, not live data."],steps:[],
    };
    const graphBaseline=graphThesisBaselineFromReport(graphReport);
    const graphInput={projectId:"sun-token",claim:"A later Graph Transfer event will appear.",metric:"graph-transfer-event",hours:8,checks:3,intervalMinutes:30};
    const thesis=store.create("owner",graphInput,graphBaseline,now);
    assert.equal(describeThesisCriterion(thesis).kind,"new-graph-transfer");
    const indexOnly={...graphBaseline,observedAt:new Date(now+60000).toISOString(),provenance:{...graphBaseline.provenance!,indexedBlock:510}};
    const unchanged=evaluateThesis(thesis,indexOnly);
    assert.equal(unchanged.met,false);
    assert.match(unchanged.observation,/index progress alone/);
    const later={...indexOnly,value:`0x${"4".repeat(64)}:0`,sourceEventAt:"2026-09-05T00:01:00Z",provenance:{...indexOnly.provenance!,eventBlock:501,eventLogIndex:0,eventTransaction:`0x${"4".repeat(64)}`}};
    const changed=evaluateThesis(thesis,later);
    assert.equal(changed.met,true);
    assert.match(changed.observation,/later Transfer entity/);
    assert.throws(()=>store.create("owner",{...graphInput,projectId:"arc-node"},graphBaseline,now),/SUN/);
  } finally {store.close();}
});
test("two worker connections fence completion across a process restart",()=>{
  const dir=mkdtempSync(join(tmpdir(),"arcmap-thesis-test-")), path=join(dir,"theses.sqlite");
  let first=new ThesisStore(path), second=new ThesisStore(path);
  try {
    const thesis=first.create("owner",input,baseline,now);
    const due=now+30*60000;
    const lease=first.claim("owner",thesis.id,due,true);
    assert.throws(()=>second.claim("owner",thesis.id,due,true),/already/);
    first.close(); first=new ThesisStore(path);
    assert.equal(first.get("owner",thesis.id)?.commitment,thesis.commitment);
    assert.equal(first.due(due).length,0);
    const recovered=second.claim("owner",thesis.id,due+61000,true);
    assert.throws(()=>first.finish("owner",thesis.id,lease.token,null,"old worker",due+61000),/lease/);
    second.finish("owner",thesis.id,recovered.token,{...baseline,observedAt:new Date(due+61000).toISOString()},null,due+61000);
    assert.equal(first.checks("owner",thesis.id).length,1);
    assert.equal(first.get("owner",thesis.id)?.remainingChecks,2);
  } finally {first.close();second.close();rmSync(dir,{recursive:true});}
});
test("thesis pins baseline, criterion and commitment across new observations",()=>{
  const store=new ThesisStore(":memory:");
  try {
    const thesis=store.create("owner",input,baseline,now);
    const criterion=describeThesisCriterion(thesis);
    assert.equal(criterion.kind,"increase-from-baseline");
    assert.equal(criterion.absoluteTarget,110);assert.equal(criterion.minimumIncrease,10);
    assert.equal(store.get("stranger",thesis.id),null);
    assert.throws(()=>store.checks("stranger",thesis.id));
    const lease=store.claim("owner",thesis.id,now+60000);
    const next=store.finish("owner",thesis.id,lease.token,{...baseline,value:108,observedAt:new Date(now+60000).toISOString()},null,now+60000);
    assert.equal(next.status,"tracking"); assert.equal(next.baseline.value,100); assert.equal(next.commitment,thesis.commitment); assert.equal(next.remainingChecks,2);
    const second=store.claim("owner",thesis.id,now+120000);
    const result=store.finish("owner",thesis.id,second.token,{...baseline,value:110,observedAt:new Date(now+120000).toISOString()},null,now+120000);
    assert.equal(result.status,"observed"); assert.equal(store.checks("owner",thesis.id).length,2); assert.equal(result.nextCheckAt,null);
  } finally {store.close();}
});
test("cancellation invalidates in-flight lease and stops scheduled checks",()=>{
  const store=new ThesisStore(":memory:");try {
    const t=store.create("a",input,baseline,now), lease=store.claim("a",t.id,now);
    assert.throws(()=>store.claim("a",t.id,now));
    store.cancel("a",t.id);
    assert.throws(()=>store.finish("a",t.id,lease.token,baseline,null,now));
    assert.equal(store.due(now+3600000).length,0);
  }finally{store.close();}
});
test("late evidence and unknown sources do not become a successful forecast",()=>{
  const store=new ThesisStore(":memory:");try{
    const t=store.create("a",input,baseline,now);
    assert.equal(evaluateThesis(t,{...baseline,value:500,observedAt:new Date(now+9*3600000).toISOString()}).met,false);
    const lease=store.claim("a",t.id,now+8*3600000);
    const result=store.finish("a",t.id,lease.token,null,"offline",now+8*3600000);
    assert.equal(result.status,"inconclusive"); assert.equal(store.checks("a",t.id)[0].sample,null);
  }finally{store.close();}
});
test("finite check budget cannot silently create an unlimited schedule",()=>{
  const store=new ThesisStore(":memory:");try{
    const t=store.create("a",{...input,checks:1},baseline,now),lease=store.claim("a",t.id,now);
    const result=store.finish("a",t.id,lease.token,baseline,null,now);
    assert.equal(result.remainingChecks,0);assert.equal(result.status,"inconclusive");assert.equal(result.nextCheckAt,null);
    assert.throws(()=>store.claim("a",t.id,now+60000));
  }finally{store.close();}
});
test("quota and stale lease fences actually reject unsafe repeats",()=>{
  const store=new ThesisStore(":memory:");try{
    for(let i=0;i<3;i++)store.reserveRequest("a",now);
    assert.throws(()=>store.reserveRequest("a",now),/limit/);
    const t=store.create("a",input,baseline,now),old=store.claim("a",t.id,now);
    const fresh=store.claim("a",t.id,now+61000);
    assert.throws(()=>store.finish("a",t.id,old.token,baseline,null,now+61000));
    store.finish("a",t.id,fresh.token,{...baseline,observedAt:new Date(now+61000).toISOString()},null,now+61000);
  }finally{store.close();}
});
