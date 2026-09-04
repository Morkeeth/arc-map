import { notFound } from "next/navigation";
import { researchProject } from "@/lib/research-catalog";
import { ProjectDetail } from "@/components/discovery";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const project = researchProject((await params).id);
  if (!project) notFound();
  return <ProjectDetail project={project} />;
}
