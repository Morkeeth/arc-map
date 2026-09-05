import { dailyBrief } from "@/lib/daily-brief";
import { personalBrief } from "@/lib/personal-brief";
import { missionAccess, missionResponse } from "@/lib/mission-access";
export const dynamic="force-dynamic";
export async function GET(request: Request) {
  const scope = new URL(request.url).searchParams.get("scope") || "all";
  if (!["all", "following"].includes(scope)) return missionResponse({error:"Choose all or following."},undefined,400);
  if (scope === "following") {
    let access;
    try { access = missionAccess(request); } catch { return missionResponse({error:"Access denied."},undefined,403); }
    try { return missionResponse(personalBrief(access.owner),access.cookie); }
    catch { return missionResponse({error:"Followed brief unavailable. No public feed was substituted."},access.cookie,503); }
  }
  try { return Response.json(dailyBrief(),{headers:{"Cache-Control":"no-store"}}); }
  catch { return missionResponse({error:"Brief source history unavailable. No substitute stories were generated."},undefined,503); }
}
