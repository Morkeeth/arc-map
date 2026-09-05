import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  const origin="http://localhost:3107",cookie=`arcmap_session=${randomBytes(32).toString("hex")}`;
  async function request(path:string,body?:unknown,identity=cookie) {
    const response=await fetch(origin+path,{headers:{Origin:origin,Cookie:identity,...(body?{"Content-Type":"application/json"}:{})},...(body?{method:"POST",body:JSON.stringify(body)}:{})});
    assert.equal(response.status,200);return {data:await response.json(),headers:response.headers};
  }
  const client=new Client({name:"arcmap-followed-brief-test",version:"1.0.0"});
  try {
    const all=await request("/api/brief");
    assert.ok(all.data.cards.length,"A real retained lead is needed");
    const target=all.data.cards[0].project.id;
    assert.equal((await request("/api/brief?scope=following")).data.cards.length,0);
    await request("/api/follows",{action:"follow",projectId:target});
    const selected=await request("/api/brief?scope=following");
    assert.match(selected.headers.get("cache-control")!,/private.*no-store/);
    assert.ok(selected.data.cards.length);assert.ok(selected.data.cards.every((c:{project:{id:string}})=>c.project.id===target));
    const stranger=await request("/api/brief?scope=following",undefined,`arcmap_session=${randomBytes(32).toString("hex")}`);
    assert.equal(stranger.data.cards.length,0);
    await client.connect(new StreamableHTTPClientTransport(new URL(origin+"/api/mcp"),{requestInit:{headers:{Origin:origin,Cookie:cookie}}}));
    const result=await client.callTool({name:"daily_brief",arguments:{scope:"following"}});
    assert.notEqual(result.isError,true);
    const data=JSON.parse((result.content as {type:string;text?:string}[]).find(c=>c.type==="text")!.text!);
    assert.deepEqual(data.cards.map((c:{id:string})=>c.id),selected.data.cards.map((c:{id:string})=>c.id));
    await request("/api/follows",{action:"unfollow",projectId:target});
    assert.equal((await request("/api/brief?scope=following")).data.cards.length,0);
    console.log(JSON.stringify({at:new Date().toISOString(),target,proofs:["live lead followed","private filtered HTTP response","stranger isolation","same scoped MCP results","unfollow removes leads"],financialActions:0}));
  } finally { await client.close(); }
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Followed brief test failed");process.exitCode=1;});
