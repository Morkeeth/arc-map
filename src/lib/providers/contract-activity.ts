import { ADDRESS } from "../analysis";
import type { Mission, MissionReport } from "../hunters";
export function parseContractActivity(payload:unknown,address:string) {
  const data=payload as {items?:any[];next_page_params?:unknown};
  if(!Array.isArray(data?.items))throw new Error("Contract activity response is invalid.");
  const seen=new Set<string>();
  const records:MissionReport["evidence"]=[];
  for(const row of data.items.slice(0,50)) {
    if(row.status!=="ok")continue;
    // Arcscan's incoming page includes the deployment itself. It is not a later call.
    if(row.to===null && String(row.created_contract?.hash).toLowerCase()===address.toLowerCase())continue;
    if(!ADDRESS.test(row.from?.hash||"")||String(row.to?.hash).toLowerCase()!==address.toLowerCase()||!/^0x[a-f0-9]{64}$/i.test(row.hash||"")||!Number.isSafeInteger(row.block_number)||row.block_number<0||typeof row.timestamp!=="string"||!Number.isFinite(Date.parse(row.timestamp))||Date.parse(row.timestamp)>Date.now()+60000)throw new Error("Invalid or unrelated contract transaction.");
    if(seen.has(row.hash.toLowerCase()))continue;
    seen.add(row.hash.toLowerCase());
    records.push({transaction:row.hash,block:row.block_number,from:row.from.hash,to:row.to.hash,timestamp:new Date(row.timestamp).toISOString(),logIndex:null});
  }
  return {records,moreAvailable:Boolean(data.next_page_params)};
}
export async function inspectContractActivity(mission:Mission):Promise<MissionReport> {
  if(!ADDRESS.test(mission.address))throw new Error("Invalid contract.");
  const url=`https://testnet.arcscan.app/api/v2/addresses/${mission.address}/transactions?filter=to`;
  const response=await fetch(url,{redirect:"error",signal:AbortSignal.timeout(12000),headers:{Accept:"application/json"},cache:"no-store"});
  if(!response.ok)throw new Error("Contract activity source unavailable.");
  const {records,moreAvailable}=parseContractActivity(await response.json(),mission.address);
  const dates=records.map(r=>r.timestamp!).sort();
  return {
    version:1,hunter:mission.hunterId,thesis:mission.thesis,provider:"explorer",source:"Arcscan / incoming contract transactions",observedAt:new Date().toISOString(),indexedBlock:null,
    stance:records.length?"limited-support":"insufficient-evidence",sampleSize:records.length,transactions:records.length,firstEventAt:dates[0]||null,lastEventAt:dates.at(-1)||null,evidence:records.slice(0,8),
    conclusion:records.length?`${records.length} successful incoming contract transactions were returned. They establish sampled calls, not independent users or economic demand.`:"No successful incoming transactions were returned. This sample cannot establish that the contract has never been used.",
    observations:[`Sample contains ${new Set(records.map(r=>r.from.toLowerCase())).size} distinct sender addresses; addresses are not people.`],
    limitations:["At most 50 incoming transactions are examined. These are contract transactions, not token-transfer events.","Contract creation is excluded from subsequent activity. Only successful calls in the returned page are counted; internal calls and failed transactions are not analyzed.","Names and source verification do not establish official affiliation, safety, demand or investment value.",...(moreAvailable?["More transactions exist outside the returned sample."]:[]),"Rules-based explorer preview. No Graph integration or financial action is implied."],
    steps:[{tool:"inspect_contract_transactions",result:`${records.length} successful transactions in a bounded incoming sample`},{tool:"test_activity_thesis",result:records.length?"limited-support":"insufficient-evidence"},{tool:"commit_report",result:"Content commitment only; no onchain payment."}],
  };
}
