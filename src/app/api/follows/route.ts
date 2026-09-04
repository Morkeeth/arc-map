import { missionAccess, missionResponse, readMissionBody } from "@/lib/mission-access";
import { followedChanges, changeFollow } from "@/lib/follow-service";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request) {
  let access;
  try {access=missionAccess(request);} catch {return missionResponse({error:"Access denied."},undefined,403);}
  try {return missionResponse(followedChanges(access.owner),access.cookie);}
  catch {return missionResponse({error:"Followed changes are unavailable. Existing follows remain saved."},access.cookie,503);}
}
export async function POST(request:Request) {
  let access;
  try {access=missionAccess(request,true);} catch {return missionResponse({error:"Access denied."},undefined,403);}
  try {changeFollow(access.owner,await readMissionBody(request));return missionResponse(followedChanges(access.owner),access.cookie);}
  catch(e) {return missionResponse({error:e instanceof Error?e.message:"Follow update failed."},access.cookie,400);}
}
