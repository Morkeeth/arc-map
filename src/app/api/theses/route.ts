import { ThesisStore, validateThesisInput } from "@/lib/thesis-store";
import { readThesisEvidence } from "@/lib/thesis-evidence";
import { missionAccess, missionResponse, readMissionBody } from "@/lib/mission-access";
import { describeThesisCriterion } from "@/lib/thesis-types";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  try { const access=missionAccess(request); const store=new ThesisStore();
    try { return missionResponse({theses:store.list(access.owner)},access.cookie); } finally {store.close();}
  } catch { return missionResponse({error:"Access denied."},undefined,403); }
}
export async function POST(request:Request) {
  let access; try {access=missionAccess(request,true);} catch {return missionResponse({error:"Access denied."},undefined,403);}
  const store=new ThesisStore();
  try {
    const input=await readMissionBody(request), config=validateThesisInput(input);
    store.reserveRequest(access.owner);
    const baseline=await readThesisEvidence(config.project.id,config.metric);
    const thesis=store.create(access.owner,input,baseline);
    return missionResponse({thesis,criterion:describeThesisCriterion(thesis)},access.cookie,201);
  } catch(e) {return missionResponse({error:e instanceof Error?e.message:"Thesis creation failed."},access.cookie,400);}
  finally {store.close();}
}
