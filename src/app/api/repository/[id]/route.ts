import { inspectRepository } from "@/lib/providers/repository";
import { missionAccess, missionResponse, readMissionBody } from "@/lib/mission-access";
import { ReleaseStore, investigateRelease } from "@/lib/release-store";
import { listRepositoryReleases } from "@/lib/providers/releases";
import { releaseComparison } from "@/lib/release-types";
export const dynamic = "force-dynamic";
// Read-only, short process cache avoids a fresh GitHub call on each UI refresh.
const cache = new Map<string, { at: number; report: ReturnType<typeof inspectRepository> }>();
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = missionAccess(request);
    const { id } = await context.params;
    if(new URL(request.url).searchParams.get("history")==="1") {
      const store=new ReleaseStore();try{return missionResponse({investigations:store.list(access.owner,id)},access.cookie);}finally{store.close();}
    }
    let value = cache.get(id);
    if (!value || Date.now() - value.at > 60000) {
      value = { at: Date.now(), report: inspectRepository(id) };
      // Only two curated repository IDs can produce successful evidence.
      if (["arc-node", "circle-agent-stack"].includes(id)) cache.set(id, value);
    }
    const [report,releases]=await Promise.all([value.report,listRepositoryReleases(id).then(index=>({index,error:null})).catch(()=>({index:null,error:"Release list unavailable. Commit evidence is separate."}))]);
    return missionResponse({ report, releases }, access.cookie);
  } catch { return missionResponse({ error: "Repository evidence unavailable. No deployment claim can be made." }, undefined, 502); }
}
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  let access;try{access=missionAccess(request,true);}catch{return missionResponse({error:"Access denied."},undefined,403);}
  try {
    const {id}=await context.params,input=await readMissionBody(request);
    const investigation=await investigateRelease(access.owner,{...input,projectId:id});
    const store=new ReleaseStore();try {
      const previous=investigation.previousId?store.get(access.owner,investigation.previousId):null;
      return missionResponse({investigation,comparison:previous?releaseComparison(previous,investigation):null},access.cookie,201);
    }finally{store.close();}
  }catch(e){return missionResponse({error:e instanceof Error?e.message:"Release investigation failed."},access.cookie,400);}
}
