import test from "node:test";
import assert from "node:assert/strict";
import {loadBrowserFollows,projectIdForAddress} from "../src/lib/browser-follows";

test("map and profile watchlists migrate only after cookie establishment; failures retain retry", async()=>{
  const originalFetch=globalThis.fetch;
  const originalStorage=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  const other=`0x${"a".repeat(40)}`;
  const saved=new Map([["arcmap.projects.v1",JSON.stringify(["sun-token"])],["arcmap.following.v1",JSON.stringify([other])]]);
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>saved.set(k,v)}});
  const follows:string[]=[]; const requests:string[]=[]; let fail=true;
  globalThis.fetch=(async (_url:unknown,init?:RequestInit)=>{
    requests.push(init?.method??"GET");
    if(init?.method==="POST"){
      assert.equal(requests[0],"GET","Cookie establishment must precede mutations");
      const body=JSON.parse(String(init.body));
      if(body.projectId===projectIdForAddress(other)&&fail)return Response.json({error:"Target no longer retained"},{status:400});
      follows.push(body.projectId);
    }
    return Response.json({follows:follows.map(projectId=>({projectId}))});
  }) as typeof fetch;
  try {
    const partial=await loadBrowserFollows();
    assert.equal(partial.migrationError,true);
    assert.deepEqual(partial.data.follows,[{projectId:"sun-token"}]);
    assert.equal(saved.has("arcmap.follows.migrated.v3"),false);
    assert.equal(saved.get("arcmap.following.v1"),JSON.stringify([other]));
    fail=false;
    const retried=await loadBrowserFollows();
    assert.equal(retried.migrationError,false);
    assert.deepEqual(retried.data.follows,[{projectId:"sun-token"},{projectId:`arc:${other}`}]);
    assert.equal(saved.get("arcmap.follows.migrated.v3"),"true");
    assert.equal(follows.filter(id=>id==="sun-token").length,1,"Successful partial migration is not duplicated");
  } finally {globalThis.fetch=originalFetch;if(originalStorage)Object.defineProperty(globalThis,"localStorage",originalStorage);else Reflect.deleteProperty(globalThis,"localStorage");}
});
