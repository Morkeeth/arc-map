import test from "node:test";
import assert from "node:assert/strict";
import { projects } from "../src/lib/projects";
import { projectIdentity, selectFollowedBrief } from "../src/lib/brief-selection";
import { buildDailyBrief } from "../src/lib/daily-brief";

test("following matches exact sourced aliases, never names or other chains", () => {
  const sun=projects.find(p=>p.id==="sun-token")!;
  assert.equal(projectIdentity(sun.id),`arc:${sun.contract!.toLowerCase()}`);
  assert.equal(projectIdentity(`arc:${sun.contract}`),projectIdentity(sun.id));
  assert.notEqual(projectIdentity(sun.name),projectIdentity(sun.id));
  assert.notEqual(projectIdentity(`ethereum:${sun.contract}`),projectIdentity(sun.id));
});
test("followed selection preserves the frozen public brief, evidence and order", () => {
  const now=Date.parse("2026-09-05T10:00:00Z"),at=new Date(now).toISOString();
  const input=buildDailyBrief({records:[],radar:[],health:[],feed:projects.slice(0,2).map((p,i)=>({id:String(i),projectId:p.id,kind:"baseline" as const,title:"Baseline",detail:"Observed baseline",sourceUrl:p.reference,observedAt:at,eventAt:null,baselineAt:null}))},now);
  const frozen=JSON.stringify(input),sun=projects[0];
  const filtered=selectFollowedBrief(input,[`arc:${sun.contract}`]);
  assert.deepEqual(filtered.cards,input.cards.filter(c=>c.project.id===sun.id));
  assert.equal(JSON.stringify(input),frozen);
  assert.equal(selectFollowedBrief(input,[]).cards.length,0);
  assert.equal(selectFollowedBrief(input,[sun.name]).cards.length,0);
  assert.match(filtered.coverage,/before you followed/);
});
