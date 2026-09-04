"use client";
import { useState } from "react";
import { Code2, ArrowUpRight } from "lucide-react";
import type { RepositoryReport } from "@/lib/providers/repository";
export function RepositoryPanel({projectId}:{projectId:string}) {
  const [report,setReport]=useState<RepositoryReport|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function run(){setBusy(true);setError("");try{const response=await fetch(`/api/repository/${encodeURIComponent(projectId)}`);const result=await response.json();if(!response.ok)throw new Error(result.error);setReport(result.report);}catch{setError("Repository evidence unavailable. No deployment claim inferred.");}finally{setBusy(false);}}
  return <section className="mission-composer"><span className="work-kicker"><Code2 size={13}/>SHIP HUNTER</span><h3>What did the source actually ship?</h3><p className="report-time">Inspect the verified repository association. A commit is not a deployment.</p><button className="work-primary-button" onClick={()=>void run()} disabled={busy}>{busy?"Reading source…":"Inspect repository"}</button>{error&&<p role="alert" className="setup-note">{error}</p>}{report?.projectId===projectId&&<div className="repository-report"><p>{report.conclusion}</p>{report.commits.slice(0,5).map(commit=><a className="evidence-link" href={commit.url} key={commit.hash} target="_blank" rel="noreferrer">{commit.title}<ArrowUpRight size={12}/></a>)}<small>Observed {new Date(report.observedAt).toLocaleString()}. At most ten default-branch commits, not all work.</small></div>}</section>;
}
