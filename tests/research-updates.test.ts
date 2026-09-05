import test from "node:test";
import assert from "node:assert/strict";
import { ThesisStore } from "../src/lib/thesis-store";
import type { ThesisSample } from "../src/lib/thesis-types";
const now=Date.parse("2026-09-05T10:00:00Z"),input={projectId:"sun-token",claim:"Transfer count increases by ten.",metric:"transfer-counter",threshold:10,hours:8,checks:8,intervalMinutes:30};
const baseline:ThesisSample={metric:"transfer-counter",value:100,observedAt:new Date(now).toISOString(),sourceUrl:"https://testnet.arcscan.app",sourceEventAt:null};
test("quiet checks create no news; failures deduplicate and recoveries remain visible",()=>{
  const s=new ThesisStore(":memory:");try{
    const t=s.create("owner",input,baseline,now);
    const finish=(minute:number,value:number|null)=>{const at=now+minute*60000,c=s.claim("owner",t.id,at);s.finish("owner",t.id,c.token,value===null?null:{...baseline,value,observedAt:new Date(at).toISOString()},value===null?"Provider timeout":null,at);};
    finish(1,100);finish(2,100);assert.equal(s.updates("owner").length,0);
    finish(3,null);finish(4,null);assert.equal(s.updates("owner").length,1);assert.equal(s.updates("owner")[0].kind,"source-failed");
    finish(5,100);assert.equal(s.updates("owner").filter(u=>u.kind==="source-recovered").length,1);
    finish(6,105);const changed=s.updates("owner").find(u=>u.kind==="evidence-changed")!;assert.ok(changed);
    assert.throws(()=>s.reviewUpdates("stranger",[changed.id]),/not found/);assert.equal(s.updates("stranger").length,0);
    s.reviewUpdates("owner",[changed.id]);assert.equal(s.updates("owner").find(u=>u.id===changed.id)!.read,true);
    finish(7,105);assert.equal(s.updates("owner").filter(u=>u.kind==="evidence-changed").length,1);
    finish(8,110);assert.equal(s.updates("owner").filter(u=>u.kind==="criterion-observed").length,1);assert.equal(s.updates("owner").filter(u=>u.kind==="monitoring-ended").length,0);
  }finally{s.close();}
});
test("ended monitoring emits an actionable limit and a new round cannot rewrite it",()=>{
  const s=new ThesisStore(":memory:");try{
    const t=s.create("owner",{...input,checks:1},baseline,now),at=now+60000,c=s.claim("owner",t.id,at);
    assert.throws(()=>s.create("owner",{...input,previousThesisId:t.id},baseline,now),/ended/);
    const old=s.finish("owner",t.id,c.token,{...baseline,observedAt:new Date(at).toISOString()},null,at);
    assert.equal(s.updates("owner")[0].kind,"monitoring-ended");
    const fresh={...baseline,value:101,observedAt:new Date(at).toISOString()};
    assert.throws(()=>s.create("other",{...input,previousThesisId:t.id},fresh,at),/ended/);
    assert.throws(()=>s.create("owner",{...input,threshold:2,previousThesisId:t.id},fresh,at),/criterion/);
    const next=s.create("owner",{...input,previousThesisId:t.id},fresh,at);
    assert.equal(next.previousCommitment,old.commitment);assert.equal(next.baseline.value,101);assert.deepEqual(s.get("owner",t.id),old);assert.equal(next.remainingChecks,8);
  }finally{s.close();}
});
