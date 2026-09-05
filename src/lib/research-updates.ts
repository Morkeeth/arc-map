import type { Thesis,ThesisCheck } from "./thesis-types";
export type ResearchUpdate={id:string;thesisId:string;projectName:string;claim:string;at:string;kind:"evidence-changed"|"source-failed"|"source-recovered"|"criterion-observed"|"monitoring-ended";title:string;detail:string;sourceUrl:string|null;read:boolean};
export function deriveResearchUpdates(thesis:Thesis,checks:ThesisCheck[]):ResearchUpdate[]{
  const updates:ResearchUpdate[]=[];let previous=thesis.baseline,failed=false;
  for(const c of [...checks].sort((a,b)=>a.id-b.id)){
    const append=(kind:ResearchUpdate["kind"],title:string,detail:string)=>updates.push({id:`${thesis.id}:${c.id}:${kind}`,thesisId:thesis.id,projectName:thesis.projectName,claim:thesis.claim,at:c.checkedAt,kind,title,detail,sourceUrl:c.sample?.sourceUrl||null,read:false});
    if(c.error||!c.sample){if(!failed)append("source-failed","Evidence source unavailable",c.error||"No valid sample was returned. No outcome can be inferred.");failed=true;continue;}
    if(failed)append("source-recovered","Evidence source recovered","A valid sample is available again. The evidence gap remains in the history.");
    failed=false;
    if(c.met)append("criterion-observed","The locked criterion was observed",c.observation);
    else if(c.sample.value!==previous.value)append("evidence-changed","The evidence changed",c.observation);
    previous=c.sample;
  }
  if(thesis.status!=="tracking"&&thesis.status!=="observed"&&thesis.status!=="cancelled"&&checks.length){
    const last=checks.at(-1)!;updates.push({id:`${thesis.id}:${last.id}:monitoring-ended`,thesisId:thesis.id,projectName:thesis.projectName,claim:thesis.claim,at:last.checkedAt,kind:"monitoring-ended",title:"Monitoring reached its limit",
      detail:thesis.status==="inconclusive"?"The check allowance or source limitations left this thesis inconclusive. No further checks are scheduled.":"No check established the criterion before the horizon. This is not proof that nothing happened.",sourceUrl:last.sample?.sourceUrl||null,read:false});
  }
  return updates;
}
