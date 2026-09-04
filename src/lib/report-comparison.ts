import type { Mission } from "./hunters";
import { keccak256, toHex } from "viem";
export function compareReports(previous:Mission,current:Mission) {
  const a=previous.report,b=current.report;
  if(!a || !b || previous.status!=="reported" || current.status!=="reported")throw new Error("Both reports must be complete.");
  if(previous.id===current.id || previous.address.toLowerCase()!==current.address.toLowerCase() || previous.provider!==current.provider || previous.hunterId!==current.hunterId || previous.thesis!==current.thesis)throw new Error("Choose different reports for the same contract, provider, Hunter and question.");
  if(previous.reportHash!==keccak256(toHex(JSON.stringify(a))) || current.reportHash!==keccak256(toHex(JSON.stringify(b))))throw new Error("Stored report commitment does not match its content.");
  if(!Number.isFinite(Date.parse(a.observedAt)) || !Number.isFinite(Date.parse(b.observedAt)) || Date.parse(b.observedAt)<=Date.parse(a.observedAt))throw new Error("The comparison requires a later observation than the pinned baseline.");
  const activityAfterBaseline=b.lastEventAt && Date.parse(b.lastEventAt)>Date.parse(a.observedAt);
  const oldExamples=new Set(a.evidence.map(e=>e.transaction.toLowerCase()));
  const newExamples=[...new Set(b.evidence.map(e=>e.transaction.toLowerCase()))].filter(hash=>!oldExamples.has(hash));
  return {
    previousMissionId:previous.id,currentMissionId:current.id,previousReportHash:previous.reportHash,currentReportHash:current.reportHash,
    provider:current.provider,question:current.thesis,baselineObservedAt:a.observedAt,currentObservedAt:b.observedAt,
    previousStance:a.stance,currentStance:b.stance,stanceChanged:a.stance!==b.stance,
    previousConclusion:a.conclusion,currentConclusion:b.conclusion,
    samples:{before:{events:a.sampleSize,transactions:a.transactions,firstEventAt:a.firstEventAt,lastEventAt:a.lastEventAt},after:{events:b.sampleSize,transactions:b.transactions,firstEventAt:b.firstEventAt,lastEventAt:b.lastEventAt}},
    activityAfterBaseline:Boolean(activityAfterBaseline),newExampleTransactions:newExamples,
    finding:activityAfterBaseline?"The later sample contains an event dated after the pinned research observation. That is evidence of subsequent sampled activity, not sustained adoption.":"No event dated after the pinned research observation appears in the later sample. This does not establish that the contract was inactive.",
    limitations:["These are two bounded source samples, not equal-duration or complete windows. Count differences are not growth rates.","New example transactions are differences between retained examples only, not every transaction in either sample.","A changed conclusion follows the Hunter's stated rule. It is not a forecast score or investment recommendation.","Reports remain immutable; this comparison does not replace either original report or its commitment."]
  };
}
