import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const root=process.env.ARCMAP_TEST_ORIGIN || "http://localhost:3107";
const cookie=`arcmap_session=${randomBytes(32).toString("hex")}`;
async function call(body?:unknown, identity=cookie) {
  const r=await fetch(`${root}/api/follows`,{method:body?"POST":"GET",headers:{Cookie:identity,Origin:root,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:r.status,data:await r.json()};
}
async function main() {
  const radar=await (await fetch(`${root}/api/radar`)).json();
  const targets=radar.projects.filter((p:{name:string})=>["Wrapped USDC","USDC/EURC"].includes(p.name)).slice(0,2);
  assert.ok(targets.length,"Live test targets unavailable; do not substitute invented records");
  for(const p of targets)assert.equal((await call({action:"follow",projectId:p.id})).status,200);
  const first=(await call()).data;
  assert.equal(first.follows.length,targets.length);assert.equal(first.events.length,0);
  const reread=(await call()).data;
  assert.equal(reread.reviewedAt,first.reviewedAt,"GET moved the pinned baseline");
  const stranger=await call({action:"review",ticket:first.ticket},`arcmap_session=${randomBytes(32).toString("hex")}`);
  assert.equal(stranger.status,400);
  assert.equal((await call({action:"review",ticket:"made-up-future-window"})).status,400);
  console.log(JSON.stringify({phase:"prepared",at:new Date().toISOString(),followed:targets.map((p:{name:string})=>p.name),durableReread:true,ownerIsolation:true,baselinePinned:true}));
  if(!process.argv.includes("--wait"))return;
  const until=Date.now()+10*60000;
  while(Date.now()<until) {
    await new Promise(r=>setTimeout(r,30000));
    const observed=(await call()).data;
    if(!Array.isArray(observed.events))throw new Error("Follow service became unavailable");
    assert.equal(observed.reviewedAt,first.reviewedAt);
    if(!observed.events.length){console.log(JSON.stringify({phase:"waiting-for-real-change",at:new Date().toISOString()}));continue;}
    const ids=new Set(observed.events.map((e:{id:string})=>e.id));
    const ack=await call({action:"review",ticket:observed.ticket});assert.equal(ack.status,200);
    assert.ok(ack.data.events.every((e:{id:string})=>!ids.has(e.id)),"Acknowledged records stayed unread");
    console.log(JSON.stringify({phase:"verified",at:new Date().toISOString(),actualRecordedChanges:observed.events.length,sourceTitles:observed.events.map((e:{title:string})=>e.title),acknowledgedWindow:true,laterRecordsPreserved:true}));return;
  }
  console.log(JSON.stringify({phase:"no-change-observed",at:new Date().toISOString(),limitation:"No real change arrived within the bounded ten-minute observation. No change was fabricated."}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Follow verification failed");process.exitCode=1;});
