import { ThesisStore } from "@/lib/thesis-store";
import { missionAccess,missionResponse,readMissionBody } from "@/lib/mission-access";
export const dynamic="force-dynamic";
export async function GET(request:Request){let access;try{access=missionAccess(request);}catch{return missionResponse({error:"Access denied."},undefined,403);}
  const store=new ThesisStore();try{const updates=store.updates(access.owner);return missionResponse({updates,unread:updates.filter(u=>!u.read).length},access.cookie);}finally{store.close();}}
export async function POST(request:Request){let access;try{access=missionAccess(request,true);}catch{return missionResponse({error:"Access denied."},undefined,403);}
  const store=new ThesisStore();try{const body=await readMissionBody(request);store.reviewUpdates(access.owner,body.ids);const updates=store.updates(access.owner);return missionResponse({updates,unread:updates.filter(u=>!u.read).length},access.cookie);}
  catch(e){return missionResponse({error:e instanceof Error?e.message:"Could not mark updates reviewed."},access.cookie,400);}finally{store.close();}}
