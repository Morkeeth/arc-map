import { ThesisDesk } from "@/components/thesis-desk";
export default async function Page({searchParams}:{searchParams:Promise<{project?:string}>}) {
  const {project}=await searchParams;
  return <ThesisDesk initialProject={typeof project==="string"?project:undefined}/>;
}
