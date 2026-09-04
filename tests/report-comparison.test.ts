import test from "node:test";
import assert from "node:assert/strict";
import { keccak256,toHex } from "viem";
import { MissionStore } from "../src/lib/mission-store";
import { compareReports } from "../src/lib/report-comparison";
import type { MissionReport } from "../src/lib/hunters";
const report:MissionReport={version:1,hunter:"distribution",thesis:"Does the sampled transfer activity extend beyond a single distribution transaction?",provider:"explorer",source:"Explicit test fixture",observedAt:"2026-09-05T00:00:00Z",indexedBlock:null,sampleSize:50,transactions:1,firstEventAt:"2026-09-04T00:00:00Z",lastEventAt:"2026-09-04T00:00:00Z",stance:"not-supported",conclusion:"One sampled transaction.",evidence:[],observations:[],limitations:[],steps:[]};
test("comparison pins reports, separates sample counts from growth, and rejects tampering",()=>{
  const store=new MissionStore(":memory:");
  try {
    const input={projectId:"sun-token",provider:"explorer",budget:"0.05"};
    const first=store.create("a",input);store.claim("a",first.id);const before=store.finish("a",first.id,report,null);
    assert.throws(()=>store.create("b",{...input,previousMissionId:first.id}),/workspace/);
    assert.throws(()=>store.create("a",{...input,provider:"graph",previousMissionId:first.id}),/same/);
    const second=store.create("a",{...input,previousMissionId:first.id});store.claim("a",second.id);
    const after=store.finish("a",second.id,{...report,observedAt:"2026-09-05T00:30:00Z",sampleSize:200},null);
    const compared=compareReports(before,after);
    assert.equal(compared.stanceChanged,false);assert.equal(compared.activityAfterBaseline,false);
    assert.equal(compared.samples.before.events,50);assert.equal(compared.samples.after.events,200);
    assert.match(compared.limitations[0],/not growth rates/);
    assert.equal(store.get("a",first.id)?.reportHash,before.reportHash);
    assert.throws(()=>compareReports(before,{...after,report:{...after.report!,transactions:999}}),/commitment/);
    const newReport={...report,observedAt:"2026-09-05T00:30:00Z",lastEventAt:"2026-09-05T00:10:00Z",transactions:2,stance:"limited-support" as const};
    const changed=compareReports(before,{...after,report:newReport,reportHash:keccak256(toHex(JSON.stringify(newReport)))});
    assert.equal(changed.activityAfterBaseline,true);assert.equal(changed.stanceChanged,true);
    assert.throws(()=>compareReports(after,before),/later/);
  }finally{store.close();}
});
