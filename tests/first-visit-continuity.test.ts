import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {RadarStore} from "../src/lib/radar-store";
import {MissionStore} from "../src/lib/mission-store";
import {ThesisStore} from "../src/lib/thesis-store";
import {dailyBrief} from "../src/lib/daily-brief";
import {POST} from "../src/app/api/theses/route";
import type {MissionReport} from "../src/lib/hunters";
const sun="0x02a0545e0f6dce7e0fb68bc4ed0e9688e29e6ee1",other=`0x${"a".repeat(40)}`;
function setup(){
 const dir=mkdtempSync(join(tmpdir(),"arc-first-visit-"));
 const vars={ARCMAP_DB_PATH:join(dir,"feed.db"),ARCMAP_RADAR_DB:join(dir,"radar.db"),ARCMAP_MISSIONS_DB:join(dir,"missions.db"),ARCMAP_THESES_DB:join(dir,"theses.db"),NEXT_PUBLIC_APP_ORIGIN:"http://localhost:3107"};
 const old=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));Object.assign(process.env,vars);
 const radar=new RadarStore();
 const record=(address:string,at:string,holders=10)=>radar.record({address,name:address===sun?"SUN":"Other",symbol:address===sun?"SUN":"OTH",kind:"token",source:"token-list",sourceUrl:`https://testnet.arcscan.app/token/${address}`,observedAt:at,eventAt:null,eventId:null,holders,sourceCodeVerified:null});
 const now=Date.now();record(sun,new Date(now-2000).toISOString());record(other,new Date(now-2000).toISOString());
 return {record,now,close(){radar.close();for(const [k,v]of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;rmSync(dir,{recursive:true,force:true});}};
}
test("a mission retains its source question when the current brief changes, and rejects expired or wrong-target leads",()=>{
 const env=setup(),store=new MissionStore();
 try{
  const lead=dailyBrief().cards.find(c=>c.project.id==="sun-token")!;assert.ok(lead);
  const input={projectId:"sun-token",provider:"explorer",budget:"0.05",leadId:lead.id};
  const saved=store.create("owner",input);assert.equal(saved.sourceLead?.question,lead.question);assert.deepEqual(saved.sourceLead?.evidence,lead.evidence);
  assert.throws(()=>store.create("owner",{...input,projectId:`arc:${other}`}),/changed or expired/);
  env.record(sun,new Date(env.now-1000).toISOString(),11);
  assert.throws(()=>store.create("owner",input),/changed or expired/);
  assert.deepEqual(store.get("owner",saved.id)?.sourceLead,saved.sourceLead,"Fresh feed changes must not rewrite saved context");
  assert.equal(store.get("stranger",saved.id),null);
 }finally{store.close();env.close();}
});
test("explorer thesis attaches the exact owned report but pins a fresh counter, and failed baselines create no thesis",async()=>{
 const env=setup(),store=new MissionStore(),theses=new ThesisStore();const originalFetch=globalThis.fetch;
 const cookie="1".repeat(64),owner=createHash("sha256").update(cookie).digest("hex");let sourceFailed=false;
 globalThis.fetch=(async()=>sourceFailed?Response.json({error:"offline"},{status:503}):Response.json({transfers_count:"123",token_holders_count:"12"})) as typeof fetch;
 try{
  const mission=store.create(owner,{projectId:"sun-token",provider:"explorer",budget:"0.05"});store.claim(owner,mission.id);
  const report:MissionReport={version:1,hunter:"distribution",thesis:mission.thesis,conclusion:"Fixture bounded sample",stance:"not-supported",provider:"explorer",source:`https://testnet.arcscan.app/token/${sun}`,observedAt:new Date().toISOString(),indexedBlock:null,sampleSize:7,transactions:1,firstEventAt:null,lastEventAt:null,evidence:[],observations:[],limitations:["Fixture data"],steps:[]};
  const done=store.finish(owner,mission.id,report,null);
  const input={projectId:"sun-token",missionId:mission.id,metric:"transfer-counter",claim:"Revisit if the source counter rises after this baseline.",threshold:1,hours:1,checks:1,intervalMinutes:15};
  const request=(body:object,token=cookie)=>POST(new Request("http://localhost:3107/api/theses",{method:"POST",headers:{Origin:"http://localhost:3107",Cookie:`arcmap_session=${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)}));
  const response=await request(input);assert.equal(response.status,201);const result=await response.json();
  assert.equal(result.thesis.baseline.value,123,"Source counter must not be replaced by seven sampled events");
  assert.deepEqual(result.research[0].report,report);assert.equal(result.research[0].reportHash,done.reportHash);
  assert.equal((await request(input,"2".repeat(64))).status,400,"Another workspace cannot attach this report");
  assert.equal((await request({...input,projectId:`arc:${other}`})).status,400,"Same-owner report cannot attach to a different contract");
  sourceFailed=true;assert.equal((await request(input)).status,400);
  assert.equal(theses.list(owner).length,1,"Failed new baseline must not leave an unattached thesis behind");
  assert.deepEqual(store.get(owner,mission.id)?.report,report);
 }finally{globalThis.fetch=originalFetch;theses.close();store.close();env.close();}
});
