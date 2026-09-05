import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, chmodSync, cpSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const root=process.cwd(),origin="http://localhost:3107",restoredOrigin="http://127.0.0.1:3118";
const cookie=`arcmap_session=${randomBytes(32).toString("hex")}`;
async function main() {
  const response=await fetch(`${origin}/api/follows`,{method:"POST",headers:{Origin:origin,Cookie:cookie,"Content-Type":"application/json"},body:JSON.stringify({action:"follow",projectId:"sun-token"})});
  assert.equal(response.status,200);const original=await response.json();
  const snapshot=mkdtempSync(resolve(".data/restore-test-"));chmodSync(snapshot,0o700);
  const mappings={ARCMAP_DB_PATH:"arcmap.sqlite",ARCMAP_RADAR_DB:"radar.sqlite",ARCMAP_MISSIONS_DB:"missions.sqlite",ARCMAP_THESES_DB:"theses.sqlite"};
  const environment:Record<string,string>={};
  for(const [key,name] of Object.entries(mappings)) {
    const source=resolve(".data",name),target=join(snapshot,name);
    const db=new DatabaseSync(source);try{db.exec("PRAGMA busy_timeout=5000");db.prepare("VACUUM INTO ?").run(target);}finally{db.close();}
    chmodSync(target,0o600);environment[key]=target;
  }
  // Complete the generated standalone package as Docker's COPY step does.
  const packaged=resolve(".next/standalone");
  assert.ok(existsSync(join(packaged,"server.js")),"Build the production package first");
  cpSync(resolve(".next/static"),join(packaged,".next/static"),{recursive:true});
  const child=spawn(process.execPath,[join(packaged,"server.js")],{cwd:packaged,env:{...process.env,...environment,PORT:"3118",HOSTNAME:"127.0.0.1",NEXT_PUBLIC_APP_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});
  let serverLog="";child.stdout.on("data",d=>{serverLog+=d;});child.stderr.on("data",d=>{serverLog+=d;});
  try {
    let ready=false;
    for(let i=0;i<40;i++) {
      if(child.exitCode!==null)throw new Error(`Standalone server exited: ${child.exitCode}`);
      try{ready=(await fetch(`${restoredOrigin}/api/follows`,{headers:{Cookie:cookie}})).ok;}catch{}
      if(ready)break;await new Promise(r=>setTimeout(r,250));
    }
    assert.ok(ready,"Standalone restore server did not become ready");
    const recovered=await (await fetch(`${restoredOrigin}/api/follows`,{headers:{Cookie:cookie}})).json();
    assert.deepEqual(recovered.follows,original.follows);assert.equal(recovered.reviewedAt,original.reviewedAt);
    const html=await (await fetch(`${restoredOrigin}/`)).text();
    const asset=html.match(/(?:src|href)="([^"]*\/_next\/static\/[^"?]+(?:\?[^\"]*)?)"/)?.[1];
    assert.ok(asset,"Production HTML must reference a packaged static asset");
    assert.equal((await fetch(new URL(asset,restoredOrigin))).status,200);
    assert.equal((await fetch(`${restoredOrigin}/api/theses`,{headers:{Cookie:cookie}})).status,200);
    console.log(JSON.stringify({at:new Date().toISOString(),standalone:true,followsRestored:true,reviewBaselinePreserved:true,staticAssetServed:true,privateThesisRoute:true,databasesRestored:Object.values(mappings),sourceDataModified:false,limitation:"Local production package and private snapshot. Not a public host, container run or cross-device account test."}));
  }finally{child.kill("SIGTERM");await new Promise<void>(r=>{if(child.exitCode!==null)r();else child.once("exit",()=>r());});}
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Restore test failed");process.exitCode=1;});
