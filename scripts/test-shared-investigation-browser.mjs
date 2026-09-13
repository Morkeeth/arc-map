const { chromium } = await import(process.env.ARCMAP_PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.ARCMAP_BROWSER_ORIGIN || 'http://localhost:3157';
const out = process.env.ARCMAP_BROWSER_EVIDENCE || '.data/shared-investigation-browser';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
const owner=await browser.newContext({viewport:{width:1280,height:900}});
const p=await owner.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>console.log('PAGE ERROR',e.message));await p.goto(base+'/hunters');
await p.waitForTimeout(2500);
const post=async(path,data)=>(await owner.request.post(base+path,{headers:{origin:base},data})).json();
const created=await post('/api/missions',{projectId:'sun-token',provider:'explorer',budget:'0.05'});
const run=await post(`/api/missions/${created.mission.id}/run`,{});
await fs.writeFile(out+'/live-report.json',JSON.stringify(run,null,2));
console.log('live status',run.mission?.status,run.mission?.report?.sampleSize,run.error);
if(!run.mission?.report) throw Error('Live report unavailable');
await p.goto(base+'/hunters?id='+created.mission.id);
await p.getByRole('button',{name:'Share this investigation',exact:true}).click();
const input=p.getByLabel('One-use contributor link');await input.waitFor();const link=await input.inputValue();
const contributor=await browser.newContext({viewport:{width:1280,height:900}});const c=await contributor.newPage();
// Hold cookie-establishing request to reproduce first-visit navigation ordering.
await c.route('**/api/follows',async route=>{const response=await route.fetch();await new Promise(r=>setTimeout(r,1500));await route.fulfill({response});});
await c.goto(link);await c.waitForTimeout(5000);
assert.equal(await c.getByRole('heading',{name:'Add sourced counterevidence'}).count(),1);
await c.getByLabel('Public source URL').fill('https://testnet.arcscan.app/address/'+run.mission.address);
await c.getByLabel('What does this source challenge?').fill('This explorer sample measures token transfers, not distinct people or sustained demand. Review that limit before relying on the distribution conclusion.');
await c.getByRole('button',{name:'Preserve counterevidence',exact:true}).click();
await c.getByText('Counterevidence preserved. The return decision now asks both researchers to reassess.',{exact:true}).waitFor();
const screenshots=[];
for (const width of [1280,390]) {
 await c.setViewportSize({width,height:900});
 await c.getByRole('region',{name:'Shared investigation'}).scrollIntoViewIfNeeded();
 const file=out+`/contributor-${width}.png`;await c.screenshot({path:file});screenshots.push(file);
 assert.equal(await c.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
}
await c.reload();await c.getByRole('heading',{name:'Add sourced counterevidence'}).waitFor();
const cdata=await (await contributor.request.get(base+'/api/missions')).json();
assert.equal(cdata.missions.length,1);assert.deepEqual(cdata.missions[0].report,run.mission.report);
assert.equal(cdata.missions[0].reportHash,run.mission.reportHash);
await p.goto(base+'/');
await p.getByText('reassess before relying on the conclusion',{exact:false}).waitFor();
await p.getByRole('region',{name:'Last investigation'}).scrollIntoViewIfNeeded();await p.screenshot({path:out+'/owner-today.png'});screenshots.push(out+'/owner-today.png');
await p.goto(base+'/hunters?id='+created.mission.id);
await p.getByRole('button',{name:'Revoke contributor access',exact:true}).waitFor();
for (const width of [1280,390]) {
 await p.setViewportSize({width,height:900});await p.getByRole('region',{name:'Shared investigation'}).scrollIntoViewIfNeeded();
 const file=out+`/owner-${width}.png`;await p.screenshot({path:file});screenshots.push(file);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
}
await p.getByRole('button',{name:'Revoke contributor access',exact:true}).click();
await p.getByText('Contributor access revoked. Preserved counterevidence remains visible to you.',{exact:true}).waitFor();
await c.reload();await c.getByText('This investigation is not available in your private workspace.',{exact:false}).waitFor();
assert.equal((await contributor.request.get(base+'/api/missions/'+created.mission.id)).status(),404);
assert.equal((await contributor.request.post(base+'/api/investigation-share',{headers:{origin:base},data:{action:'counterevidence',missionId:created.mission.id,sourceUrl:'https://example.com',note:'This must be rejected after access was revoked.'}})).status(),400);
const final=await (await owner.request.get(base+'/api/missions/'+created.mission.id)).json();
assert.equal(final.mission.collaboration.counterevidence.length,1);assert.deepEqual(final.mission.report,run.mission.report);assert.equal(final.mission.reportHash,run.mission.reportHash);
await fs.writeFile(out+'/browser-result.json',JSON.stringify({checkedAt:new Date().toISOString(),missionId:created.mission.id,provider:run.mission.report.provider,sampleSize:run.mission.report.sampleSize,reportHash:run.mission.reportHash,delayedCookieResponseMs:1500,contributorReload:true,ownerTodayReassess:true,revokeReadStatus:404,revokeWriteStatus:400,contributionsRetained:1,screenshots},null,2));
console.log('Browser journey PASS',created.mission.id,screenshots);
} finally { await browser.close(); }
