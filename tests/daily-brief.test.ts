import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyBrief } from "../src/lib/daily-brief";
import type { RadarEvent,RadarRecord } from "../src/lib/radar-types";
const now=Date.parse("2026-09-05T10:00:00Z"),at=new Date(now).toISOString(),address="0x"+"1".repeat(40);
const record:RadarRecord={id:`arc:${address}`,address,name:"Observed contract",symbol:null,kind:"contract",firstObservedAt:at,lastObservedAt:at,verifiedAt:null,lastActivityAt:at,holders:null,sourceCodeVerified:null,sources:["transaction"]};
const event=(id:string,url:string,eventAt:string|null=at):RadarEvent=>({id,address,name:record.name,symbol:null,kind:"contract",source:"transaction",sourceUrl:url,observedAt:at,eventAt,eventId:id,holders:null,sourceCodeVerified:null,title:"Contract activity observed"});
test("brief groups actual transaction identities without counting duplicate rows or calling them users",()=>{
  const e=event("a","https://testnet.arcscan.app/tx/a");
  const result=buildDailyBrief({feed:[],records:[record],radar:[e,e,event("b","https://testnet.arcscan.app/tx/b")],health:[{sourceId:"radar:transaction",lastAttempt:at,lastSuccess:at,error:null}]},now);
  assert.equal(result.cards.length,1);assert.equal(result.cards[0].observations,2);assert.match(result.cards[0].headline,/2 sampled transactions/);assert.equal(result.cards[0].sourceStatus,"fresh");assert.match(result.cards[0].counterevidence,/do not establish unique users/);
  assert.equal(buildDailyBrief({feed:[],records:[record],radar:[e,e],health:[]},now).cards[0].observations,1);
});
test("old events, failed sources and new observations keep their distinct dates and limits",()=>{
  const old="2026-06-01T00:00:00Z",e=event("a","https://testnet.arcscan.app/tx/a",old);
  const input={feed:[],records:[record],radar:[e],health:[{sourceId:"radar:transaction",lastAttempt:at,lastSuccess:old,error:"timeout"}]};
  const a=buildDailyBrief(input,now),b=buildDailyBrief(input,now+1000);
  assert.equal(a.cards[0].firstEventAt,old);assert.equal(a.cards[0].observedAt,at);assert.equal(a.cards[0].sourceStatus,"unavailable");assert.equal(a.cards[0].id,b.cards[0].id,"Refreshing does not invent a new story identity");
  assert.equal(buildDailyBrief({...input,radar:[{...e,observedAt:old}]},now).cards.length,0);
  assert.equal(buildDailyBrief({...input,radar:[{...e,observedAt:new Date(now+1000).toISOString()}]},now).cards.length,0);
});
test("same contract names never merge different addresses",()=>{
  const second={...record,id:`arc:0x${"2".repeat(40)}`,address:`0x${"2".repeat(40)}`};
  const result=buildDailyBrief({feed:[],records:[record,second],radar:[event("a","https://example.com/a"),{...event("b","https://example.com/b"),address:second.address}],health:[]},now);
  assert.equal(result.cards.length,2);assert.notEqual(result.cards[0].project.id,result.cards[1].project.id);
});
test("invalid and future health timestamps cannot claim a fresh source",()=>{
  for(const lastSuccess of ["invalid",new Date(now+1000).toISOString()]) {
    const result=buildDailyBrief({feed:[],records:[record],radar:[event("a","https://example.com/a")],health:[{sourceId:"radar:transaction",lastAttempt:at,lastSuccess,error:null}]},now);
    assert.equal(result.cards[0].sourceStatus,"stale");
  }
});
