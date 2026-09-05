import { dailyBrief } from "@/lib/daily-brief";
export const dynamic="force-dynamic";
export async function GET(){try{return Response.json(dailyBrief(),{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({error:"Brief source history unavailable. No substitute stories were generated."},{status:503});}}
