import { notFound } from "next/navigation";
import { researchProject } from "@/lib/research-catalog";
import { Workspace } from "@/components/workspace";

export default async function HuntersPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; project?: string }>;
}) {
  const { id, project } = await searchParams;
  const target = typeof project === "string" ? researchProject(project) : undefined;
  if (project && !target) notFound();
  return (
    <Workspace
      key={typeof id === "string" ? `mission:${id}` : target ? `project:${target.id}` : "hunters"}
      initialView="hunters"
      initialProject={target}
      initialMissionId={typeof id === "string" ? id : undefined}
    />
  );
}
