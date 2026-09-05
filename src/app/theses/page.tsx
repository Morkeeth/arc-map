import { ThesisDesk } from "@/components/thesis-desk";
export default async function Page({searchParams}:{searchParams:Promise<{project?:string;id?:string}>}) {
  const {project,id}=await searchParams;
  return <ThesisDesk key={typeof id==="string"?id:typeof project==="string"?project:"latest"} initialProject={typeof project==="string"?project:undefined} initialThesis={typeof id==="string"?id:undefined}/>;
}
