import test from "node:test";
import assert from "node:assert/strict";
import { parseContractActivity } from "../src/lib/providers/contract-activity";
import { parseRepositoryCommits } from "../src/lib/providers/repository";
const target="0x1111111111111111111111111111111111111111";
test("contract transactions are deduplicated and never assigned token log indices",()=>{
  const row={status:"ok",hash:"0x"+"a".repeat(64),from:{hash:"0x"+"2".repeat(40)},to:{hash:target},block_number:100,timestamp:"2026-09-04T00:00:00Z"};
  const parsed=parseContractActivity({items:[row,row,{...row,status:"error"}],next_page_params:{}},target);
  assert.equal(parsed.records.length,1);assert.equal(parsed.records[0].logIndex,null);
  assert.throws(()=>parseContractActivity({items:[{...row,to:{hash:"0x"+"3".repeat(40)}}]},target),/unrelated/);
});
test("repository claims use actual commit structure and reject unknown event times",()=>{
  const row={sha:"a".repeat(40),commit:{message:"Change API\nDetails",committer:{date:"2026-09-04T00:00:00Z"}}};
  const [commit]=parseRepositoryCommits([row],"circlefin/arc-node");
  assert.equal(commit.title,"Change API");assert.equal(commit.url,`https://github.com/circlefin/arc-node/commit/${row.sha}`);
  assert.throws(()=>parseRepositoryCommits([{...row,commit:{...row.commit,committer:{date:"unknown"}}}],"circlefin/arc-node"));
});
