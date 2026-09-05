import { projects } from "../projects";
import type { ReleaseEvidence, ReleaseLookup } from "../release-types";

export function repositoryFor(projectId: unknown) {
  const project=projects.find(p=>p.id===projectId&&p.repo);
  if(!project?.repo)throw new Error("Choose a project with a sourced repository association.");
  return project.repo;
}
export function validateReleaseTag(value:unknown):string {
  if(typeof value!=="string" || !value.trim() || value.length>120 || /[\x00-\x20\x7f]/.test(value) || value==="." || value==="..")
    throw new Error("Use an exact release tag of 1–120 characters without spaces.");
  return value;
}
export function parseRelease(payload:unknown,repository:string,expectedTag?:string,now=Date.now()):ReleaseEvidence {
  if(!payload || typeof payload!=="object")throw new Error("Invalid release response.");
  const r=payload as Record<string,unknown>;
  const tag=validateReleaseTag(r.tag_name), published=typeof r.published_at==="string"?Date.parse(r.published_at):NaN;
  if(!Number.isSafeInteger(r.id)||Number(r.id)<1||r.draft!==false||typeof r.prerelease!=="boolean"||!Number.isFinite(published)||published>now+60000||expectedTag&&tag!==expectedTag)
    throw new Error("Release evidence does not match the requested public tag.");
  if(r.name!==null&&r.name!==undefined&&typeof r.name!=="string" || r.body!==null&&r.body!==undefined&&typeof r.body!=="string")throw new Error("Invalid release text.");
  const notes=typeof r.body==="string"?r.body:"";
  return {id:Number(r.id),tag,name:typeof r.name==="string"?r.name.slice(0,180):tag,publishedAt:new Date(published).toISOString(),prerelease:r.prerelease,
    url:`https://github.com/${repository}/releases/tag/${encodeURIComponent(tag)}`,notes:notes.slice(0,2000),notesTruncated:notes.length>2000};
}
async function github(url:string) {
  return fetch(url,{redirect:"error",signal:AbortSignal.timeout(12000),cache:"no-store",headers:{Accept:"application/vnd.github+json","User-Agent":"arcmap-ship-hunter"}});
}
export async function lookupRelease(projectId:string,tag:string):Promise<ReleaseLookup> {
  const repository=repositoryFor(projectId);validateReleaseTag(tag);
  const sourceUrl=`https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`;
  try {
    const r=await github(sourceUrl),observedAt=new Date().toISOString();
    if(r.status===404)return {sourceUrl,observedAt,status:"not-found",release:null,error:null};
    if(!r.ok)throw new Error(`GitHub returned HTTP ${r.status}.`);
    return {sourceUrl,observedAt,status:"found",release:parseRelease(await r.json(),repository,tag),error:null};
  }catch(e){return {sourceUrl,observedAt:new Date().toISOString(),status:"unavailable",release:null,error:e instanceof Error?e.message:"Release source unavailable."};}
}
const recent=new Map<string,{until:number;value:Promise<{releases:ReleaseEvidence[];observedAt:string;sourceUrl:string;coverage:string}>}>();
export function listRepositoryReleases(projectId:string) {
  const repository=repositoryFor(projectId),cached=recent.get(projectId);
  if(cached&&cached.until>Date.now())return cached.value;
  const value=(async()=>{
    const sourceUrl=`https://api.github.com/repos/${repository}/releases?per_page=10`,r=await github(sourceUrl);
    if(!r.ok)throw new Error(`GitHub releases returned HTTP ${r.status}.`);
    const data=await r.json();if(!Array.isArray(data))throw new Error("Invalid release list.");
    return {releases:data.slice(0,10).map(item=>parseRelease(item,repository)),observedAt:new Date().toISOString(),sourceUrl,
      coverage:"At most ten public GitHub releases. Not all Git tags or all release history. An exact-tag investigation uses a separate direct lookup."};
  })();
  recent.set(projectId,{until:Date.now()+60000,value});return value;
}
