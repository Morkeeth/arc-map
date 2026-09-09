import { ThesisDesk } from "@/components/thesis-desk";
export default async function Page({searchParams}:{searchParams:Promise<{project?:string;id?:string;mission?:string}>}) {
  const {project,id,mission}=await searchParams;
  return <ThesisDesk key={typeof id==="string"?id:typeof mission==="string"?mission:typeof project==="string"?project:"latest"} initialProject={typeof project==="string"?project:undefined} initialThesis={typeof id==="string"?id:undefined} initialMission={typeof mission==="string"?mission:undefined}/>;
}
