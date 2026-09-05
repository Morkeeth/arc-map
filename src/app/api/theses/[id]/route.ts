import { ThesisStore, checkThesis } from "@/lib/thesis-store";
import { missionAccess, missionResponse, readMissionBody } from "@/lib/mission-access";
import { describeThesisCriterion } from "@/lib/thesis-types";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context) {
  try { const access=missionAccess(request), {id}=await context.params, store=new ThesisStore();
    try {
      const thesis=store.get(access.owner,id);
      return thesis ? missionResponse({thesis,criterion:describeThesisCriterion(thesis),checks:store.checks(access.owner,id),research:store.research(access.owner,id)},access.cookie) : missionResponse({error:"Thesis not found."},access.cookie,404);
    } finally {store.close();}
  } catch {return missionResponse({error:"Access denied."},undefined,403);}
}
export async function POST(request:Request,context:Context) {
  let access; try {access=missionAccess(request,true);} catch {return missionResponse({error:"Access denied."},undefined,403);}
  const store=new ThesisStore();
  try {
    const {id}=await context.params,input=await readMissionBody(request);
    if(input.action==="attach") {
      if(typeof input.missionId!=="string")throw new Error("Report ID required.");
      store.attachResearch(access.owner,id,input.missionId);
    }
    const thesis=input.action==="check" ? await checkThesis(store,access.owner,id) : input.action==="cancel" ? store.cancel(access.owner,id) : input.action==="attach"?store.get(access.owner,id):null;
    if (!thesis) throw new Error("Choose check, cancel or attach.");
    return missionResponse({thesis,criterion:describeThesisCriterion(thesis),checks:store.checks(access.owner,id),research:store.research(access.owner,id)},access.cookie);
  } catch(e) {return missionResponse({error:e instanceof Error?e.message:"Thesis action failed."},access.cookie,400);}
  finally {store.close();}
}
