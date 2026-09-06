import { Workspace } from "@/components/workspace";

export default async function HuntersPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return (
    <Workspace
      initialView="hunters"
      initialMissionId={typeof id === "string" ? id : undefined}
    />
  );
}
