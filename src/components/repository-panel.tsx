"use client";
import { useState,useEffect } from "react";
import { Code2,ArrowUpRight } from "lucide-react";
import type { RepositoryReport } from "@/lib/providers/repository";
import type { ReleaseEvidence,ReleaseInvestigation } from "@/lib/release-types";
import { releaseComparison } from "@/lib/release-types";
export function RepositoryPanel({projectId}:{projectId:string}) {
  const [report,setReport]=useState<RepositoryReport|null>(null),[releases,setReleases]=useState<ReleaseEvidence[]>([]),[history,setHistory]=useState<ReleaseInvestigation[]>([]);
  const [selected,setSelected]=useState<ReleaseInvestigation|null>(null),[tag,setTag]=useState(""),[stable,setStable]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{let active=true;setReport(null);setReleases([]);setSelected(null);setTag("");setHistory([]);setError("");
    void fetch(`/api/repository/${encodeURIComponent(projectId)}?history=1`).then(r=>r.json()).then(data=>{if(active){if(data.error)setError(data.error);else setHistory(data.investigations);}}).catch(()=>{if(active)setError("Saved release investigations unavailable.");});return()=>{active=false;};},[projectId]);
  async function run(){setBusy(true);setError("");try{const response=await fetch(`/api/repository/${encodeURIComponent(projectId)}`);const result=await response.json();if(!response.ok)throw new Error(result.error);setReport(result.report);setReleases(result.releases?.index?.releases||[]);if(result.releases?.error)setError(result.releases.error);}catch{setError("Repository evidence unavailable. No deployment claim inferred.");}finally{setBusy(false);}}
  async function investigate(previous?:ReleaseInvestigation){setBusy(true);setError("");try{
    const response=await fetch(`/api/repository/${encodeURIComponent(projectId)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tag:previous?.tag||tag,requireStable:previous?.requireStable??stable,previousId:previous?.id})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||"Investigation failed.");
    setSelected(data.investigation);setHistory(items=>[data.investigation,...items]);
  }catch(e){setError(e instanceof Error?e.message:"Release investigation failed.");}finally{setBusy(false);}}
  const current=selected?.projectId===projectId?selected:null,previous=current?.previousId?history.find(r=>r.id===current.previousId):null;
  const comparison=previous&&current?releaseComparison(previous,current):null;
  return <section className="mission-composer"><span className="work-kicker"><Code2 size={13}/>SHIP HUNTER</span><h3>What did the source actually ship?</h3><p className="report-time">Separate code changes, published releases and network deployment.</p>
    <button className="work-primary-button" onClick={()=>void run()} disabled={busy}>{busy?"Reading source…":"Inspect repository"}</button>
    {error&&<p role="alert" className="setup-note">{error}</p>}
    {report?.projectId===projectId&&<div className="repository-report"><p>{report.conclusion}</p>{report.commits.slice(0,3).map(commit=><a className="evidence-link" href={commit.url} key={commit.hash} target="_blank" rel="noreferrer">{commit.title}<ArrowUpRight size={12}/></a>)}<small>Observed {new Date(report.observedAt).toLocaleString()}. At most ten default-branch commits.</small>
      <h4>Published release sample</h4>{releases.length?<div className="hunter-tool-list">{releases.map(r=><button type="button" className="work-refresh work-text-button" key={r.id} onClick={()=>{setTag(r.tag);setSelected(null);}}>{r.tag}{r.prerelease?" · prerelease":""}</button>)}</div>:<p className="report-time">No releases in the returned sample, or the release source is unavailable above. You can still check an exact tag.</p>}<p className="report-time">Up to ten public releases, not all Git tags. Select a tag to investigate it.</p></div>}
    <form className="thesis-form" onSubmit={e=>{e.preventDefault();void investigate();}}><label>Exact release tag<input value={tag} maxLength={120} onChange={e=>setTag(e.target.value)} placeholder="Use a tag from the source" required/></label><label>Release criterion<select value={stable?"stable":"any"} onChange={e=>setStable(e.target.value==="stable")}><option value="stable">Published stable release</option><option value="any">Published release, including prereleases</option></select></label><p className="report-time">This checks GitHub publication of the exact tag. It does not check whether the network runs it.</p><button className="work-primary-button" disabled={busy||!tag}>Investigate release</button></form>
    {history.length>0&&<label className="thesis-form">Saved investigations<select value={current?.id||""} onChange={e=>setSelected(history.find(r=>r.id===e.target.value)||null)}><option value="">Choose a saved investigation</option>{history.map(r=><option value={r.id} key={r.id}>{r.tag} · {r.requireStable?"stable":"any release"} · {new Date(r.createdAt).toLocaleString()}</option>)}</select></label>}
    {current&&<article className="repository-report"><span className="work-kicker">{current.verdict.replaceAll("-"," ")}</span><h4>{current.question}</h4><p>{current.conclusion}</p><small>Source checked {new Date(current.lookup.observedAt).toLocaleString()}</small>
      {current.lookup.error&&<p className="setup-note">{current.lookup.error}</p>}
      {current.lookup.release&&<><a className="evidence-link" href={current.lookup.release.url} target="_blank" rel="noreferrer">{current.lookup.release.name}<ArrowUpRight size={12}/></a><p className="report-time">Published {new Date(current.lookup.release.publishedAt).toLocaleString()} · {current.lookup.release.prerelease?"prerelease":"stable flag"}</p><details><summary>Publisher’s release notes</summary><p className="release-notes">{current.lookup.release.notes||"No notes returned."}</p>{current.lookup.release.notesTruncated&&<p className="report-time">First 2,000 characters only. Read the linked source for full notes.</p>}</details></>}
      <a className="evidence-link" href={current.lookup.sourceUrl} target="_blank" rel="noreferrer">Exact source response<ArrowUpRight size={12}/></a>
      {current.codeError&&<p className="setup-note">{current.codeError}</p>}
      {comparison&&<section className="report-comparison"><span className="work-kicker">PINNED COMPARISON</span><p>{comparison.finding}</p><p className="report-time">Release response {comparison.sourceChanged?"differs":"unchanged"}. Default-branch head {comparison.headChanged===null?"unknown":comparison.headChanged?"differs":"unchanged"}.</p><p className="report-time">{comparison.limitation}</p></section>}
      <details><summary>Scope and saved commitment</summary>{current.limitations.map(l=><p className="report-time" key={l}>{l}</p>)}<code className="report-hash">{current.commitment}</code></details><button className="work-refresh work-text-button" disabled={busy} onClick={()=>void investigate(current)}>Recheck release and compare</button>
    </article>}
  </section>;
}
