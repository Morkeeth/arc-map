import test from "node:test";
import assert from "node:assert/strict";
import { ThesisStore } from "../src/lib/thesis-store";
import { evaluateThesis } from "../src/lib/thesis-evidence";
import type { ThesisSample } from "../src/lib/thesis-types";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const now=Date.parse("2026-09-05T00:00:00Z");
const baseline:ThesisSample={metric:"transfer-counter",observedAt:new Date(now).toISOString(),sourceUrl:"https://testnet.arcscan.app",value:100,sourceEventAt:null};
const input={projectId:"sun-token",claim:"The transfer counter will rise by ten.",metric:"transfer-counter",threshold:10,hours:8,checks:3,intervalMinutes:30};
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
