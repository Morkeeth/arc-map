import { notFound } from "next/navigation";
import { findProject } from "@/lib/projects";
import { ProjectDetail } from "@/components/discovery";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const project = findProject((await params).id);
  if (!project) notFound();
  return <ProjectDetail project={project} />;
}
