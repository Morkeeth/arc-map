import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
const origin="http://localhost:3107",cookie=`arcmap_session=${randomBytes(32).toString("hex")}`;
async function call(path:string,body?:unknown,ownerCookie=cookie){const response=await fetch(`${origin}${path}`,{method:body?"POST":"GET",headers:{Origin:origin,Cookie:ownerCookie,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}
async function main(){
  const brief=await call("/api/brief");assert.equal(brief.status,200);assert.ok(brief.data.cards.length>0,"Live retained observations required");
  const lead=brief.data.cards[0];assert.ok(lead.evidence.length>0);assert.ok(lead.counterevidence);assert.ok(lead.rankReason);
  const input={projectId:"sun-token",claim:"The source transfer counter rises by one.",metric:"transfer-counter",threshold:1,hours:1,intervalMinutes:15,checks:1};
  const created=await call("/api/theses",input);assert.equal(created.status,201);
  const id=created.data.thesis.id;
  const checked=await call(`/api/theses/${id}`,{action:"check"});assert.equal(checked.status,200);assert.equal(checked.data.thesis.remainingChecks,0);
  const inbox=await call("/api/research-updates");assert.equal(inbox.status,200);assert.ok(inbox.data.unread>0);
  const ids=inbox.data.updates.map((u:{id:string})=>u.id);
  const other=`arcmap_session=${randomBytes(32).toString("hex")}`;
  assert.equal((await call("/api/research-updates",{ids},other)).status,400);
  assert.equal((await call("/api/research-updates",undefined,other)).data.updates.length,0);
  assert.equal((await call("/api/research-updates")).data.unread,inbox.data.unread,"Read does not acknowledge");
  const reviewed=await call("/api/research-updates",{ids});assert.equal(reviewed.status,200);assert.equal(reviewed.data.unread,0);
  const next=await call("/api/theses",{...input,previousThesisId:id});assert.equal(next.status,201);assert.equal(next.data.thesis.previousCommitment,created.data.thesis.commitment);
  assert.deepEqual((await call(`/api/theses/${id}`)).data.thesis,checked.data.thesis,"New round preserves ended result");
  const cancelled=await call(`/api/theses/${next.data.thesis.id}`,{action:"cancel"});assert.equal(cancelled.status,200);assert.equal(cancelled.data.thesis.status,"cancelled");
  console.log(JSON.stringify({at:new Date().toISOString(),liveBrief:{cards:brief.data.cards.length,firstProject:lead.project.name,kind:lead.kind,sourceStatus:lead.sourceStatus},realCounterBaseline:created.data.thesis.baseline.value,checkedState:checked.data.thesis.status,updateKinds:inbox.data.updates.map((u:{kind:string})=>u.kind),proofs:["real source brief","finite live thesis check","owned inbox and isolation","read does not acknowledge","explicit review persists","new round pins ended commitment","new round cancelled"],limitation:"Local HTTP flow with fresh isolated workspace. No fake source changes, public deployment or financial action."}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Daily flow failed");process.exitCode=1;});
