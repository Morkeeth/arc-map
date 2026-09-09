"use client";
import { useState,useEffect } from "react";
import type { Thesis,ThesisResearch } from "@/lib/thesis-types";
import type { Mission } from "@/lib/hunters";
import type { Project } from "@/lib/projects";
export function ThesisResearchPanel({thesis,project}:{thesis:Thesis;project:Project|undefined}) {
  const [reports,setReports]=useState<ThesisResearch[]>([]),[available,setAvailable]=useState<Mission[]>([]),[chosen,setChosen]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{void Promise.all([fetch(`/api/theses/${thesis.id}`).then(r=>r.json()),fetch("/api/missions").then(r=>r.json())]).then(([a,b])=>{
    if(a.error||b.error)throw new Error("Research history unavailable.");
    setReports(a.research||[]);setAvailable((b.missions||[]).filter((m:Mission)=>m.status==="reported"&&m.address.toLowerCase()===project?.contract?.toLowerCase()));
  }).catch(()=>setError("Research history unavailable. Existing reports are not removed."));},[thesis.id,project?.contract]);
  async function attach(){setBusy(true);setError("");try{
    const response=await fetch(`/api/theses/${thesis.id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"attach",missionId:chosen})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not attach research.");setReports(result.research);setChosen("");
  }catch(e){setError(e instanceof Error?e.message:"Attachment failed.");}finally{setBusy(false);}}
  return <section className="thesis-research"><h3>Hunter research</h3><p className="report-time">Attach a completed investigation of this contract. It adds context; only the locked criterion determines the thesis outcome.</p>
    {error&&<p className="setup-note" role="alert">{error}</p>}
    {reports.map(r=><article className="thesis-check" key={r.missionId}><span className="work-kicker">{r.report.provider} · observed {new Date(r.report.observedAt).toLocaleString()}</span><p>{r.report.conclusion}</p><small>{r.report.sampleSize} sampled events · {r.report.transactions} {r.report.transactions===1?"transaction":"transactions"}{r.report.provider==="graph"?` · Transfer entities · Arc testnet 5042002 · indexed block ${r.report.indexedBlock}`:" · explorer source"}</small>
      <div className="hunter-tool-list">{[...new Set(r.report.evidence.map(e=>e.transaction))].slice(0,3).map(transaction=><a className="evidence-link" href={`https://testnet.arcscan.app/tx/${transaction}`} target="_blank" rel="noreferrer" key={transaction}>{transaction.slice(0,10)}…</a>)}</div>
      <details><summary>Original report and limits</summary>{r.report.limitations.map(l=><p className="report-time" key={l}>{l}</p>)}<code className="report-hash">{r.reportHash}</code></details></article>)}
    {available.length>0?<div className="thesis-form"><label>Completed report<select value={chosen} onChange={e=>setChosen(e.target.value)}><option value="">Choose a report to attach</option>{available.filter(m=>!reports.some(r=>r.missionId===m.id)).map(m=><option key={m.id} value={m.id}>{m.provider} · {new Date(m.report!.observedAt).toLocaleString()} · {m.report!.sampleSize} events</option>)}</select></label><button className="work-refresh work-text-button" disabled={!chosen||busy} onClick={()=>void attach()}>{busy?"Attaching…":"Attach research"}</button></div>:<p className="report-time">No completed investigation of this contract is saved in this workspace yet. Inspect the project and run a Hunter first.</p>}
  </section>;
}
