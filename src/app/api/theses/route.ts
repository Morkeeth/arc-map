import { keccak256, toHex } from "viem";
import { ThesisStore, validateThesisInput } from "@/lib/thesis-store";
import {
  graphThesisBaselineFromReport,
  readThesisEvidence,
} from "@/lib/thesis-evidence";
import { missionAccess, missionResponse, readMissionBody } from "@/lib/mission-access";
import { describeThesisCriterion } from "@/lib/thesis-types";
import { MissionStore } from "@/lib/mission-store";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  try { const access=missionAccess(request); const store=new ThesisStore();
    try { return missionResponse({theses:store.list(access.owner)},access.cookie); } finally {store.close();}
  } catch { return missionResponse({error:"Access denied."},undefined,403); }
}
export async function POST(request:Request) {
  let access; try {access=missionAccess(request,true);} catch {return missionResponse({error:"Access denied."},undefined,403);}
  const store=new ThesisStore();
  const missions=new MissionStore();
  try {
    const input=await readMissionBody(request), config=validateThesisInput(input);
    store.reserveRequest(access.owner);
    let baseline;
    let baselineMissionId: string | null = null;
    if (input.missionId !== undefined) {
      if (typeof input.missionId !== "string") throw new Error("Choose a completed research report.");
      const mission = missions.get(access.owner, input.missionId);
      if (!mission?.report || !mission.reportHash || mission.status !== "reported" || mission.projectId !== config.project.id || mission.address.toLowerCase() !== config.project.contract?.toLowerCase() || keccak256(toHex(JSON.stringify(mission.report))) !== mission.reportHash) throw new Error("Choose your completed report for this exact project.");
      if (config.metric === "graph-transfer-event") {
        if(mission.provider !== "graph") throw new Error("A Graph event condition needs a Graph report.");
        baseline = graphThesisBaselineFromReport(mission.report);
      } else {
        baseline = await readThesisEvidence(config.project.id, config.metric);
      }
      baselineMissionId = mission.id;
    } else {
      baseline = await readThesisEvidence(config.project.id, config.metric);
    }
    const thesis=store.create(access.owner,input,baseline);
    if (baselineMissionId)
      store.attachResearch(
        access.owner,
        thesis.id,
        baselineMissionId,
        missions,
      );
    return missionResponse({thesis,criterion:describeThesisCriterion(thesis),research:store.research(access.owner,thesis.id)},access.cookie,201);
  } catch(e) {return missionResponse({error:e instanceof Error?e.message:"Thesis creation failed."},access.cookie,400);}
  finally {missions.close();store.close();}
}
