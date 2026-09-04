import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FollowStore } from "../src/lib/follow-store";
import { FeedStore } from "../src/lib/feed-store";
const now=Date.parse("2026-09-05T00:00:00Z");
test("follows and review position survive reopening without crossing owners",()=>{
  const dir=mkdtempSync(join(tmpdir(),"arcmap-follows-")),path=join(dir,"workspace.sqlite");
  let store=new FollowStore(path);
  try {
    store.follow("a","sun-token",{feed:2,radar:3},now);
    store.close();store=new FollowStore(path);
    assert.equal(store.list("a")[0].projectId,"sun-token");assert.equal(store.list("b").length,0);
    assert.equal(store.position("a")?.feed,2);
    const ticket=store.ticket("a",{feed:5,radar:7},now+1000);
    assert.throws(()=>store.acknowledge("b",ticket,now+2000));
    assert.equal(store.position("a")?.feed,2,"Reading a window must not advance review");
    store.acknowledge("a",ticket,now+2000);
    assert.equal(store.position("a")?.feed,5);
    assert.throws(()=>store.acknowledge("a",ticket,now+3000),/expired/);
  }finally{store.close();rmSync(dir,{recursive:true});}
});
test("older tabs cannot rewind review, invent a cursor or erase later records",()=>{
  const store=new FollowStore(":memory:");
  try {
    store.follow("a","sun-token",{feed:2,radar:3},now);
    const older=store.ticket("a",{feed:5,radar:5},now+1000);
    const newer=store.ticket("a",{feed:8,radar:6},now+2000);
    store.acknowledge("a",newer,now+3000);store.acknowledge("a",older,now+4000);
    assert.deepEqual(store.position("a"),{feed:8,radar:6,reviewedAt:new Date(now+2000).toISOString()});
    assert.throws(()=>store.acknowledge("a","future",now+5000));
    const expired=store.ticket("a",{feed:9,radar:9},now);
    assert.throws(()=>store.acknowledge("a",expired,now+3600001));
    store.unfollow("a","sun-token");store.follow("a","sun-token",{feed:12,radar:13},now+6000);
    assert.equal(store.list("a")[0].feed,12,"Re-follow starts a new source baseline");
  }finally{store.close();}
});
test("event sequence catches late-arriving records with old observation timestamps",()=>{
  const feed=new FeedStore(":memory:");
  try {
    const row={projectId:"arc-node",sourceId:"github:a",kind:"code" as const,sourceUrl:"https://github.com/circlefin/arc-node",observedAt:new Date(now).toISOString(),eventAt:new Date(now-1000).toISOString(),payload:{commit:"a".repeat(40),message:"One"}};
    feed.record(row);const pinned=feed.eventHead();
    feed.record({...row,sourceId:"github:b",observedAt:new Date(now-2000).toISOString(),payload:{commit:"b".repeat(40),message:"Earlier response arrived later"}});
    const rows=feed.eventsAfter(pinned,feed.eventHead());
    assert.equal(rows.length,1);assert.ok(rows[0].event.observedAt<row.observedAt);
    assert.equal(feed.eventsAfter(0,pinned).length,1,"Pinned window excludes later insertions");
  }finally{feed.close();}
});
