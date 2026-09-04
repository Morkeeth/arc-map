import { sourceIds } from "@/lib/projects";
import { researchProject } from "@/lib/research-catalog";
import { FeedStore } from "@/lib/feed-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const project = researchProject((await context.params).id);
  if (!project)
    return Response.json({ error: "Unknown project" }, { status: 404 });
  const store = new FeedStore();
  try {
    return Response.json(
      {
        project,
        observations: sourceIds(project)
          .map((id) => store.latest(id))
          .filter(Boolean),
        events: store
          .events()
          .filter((event) => event.projectId === project.id),
        sources: store
          .health()
          .filter((source) => sourceIds(project).includes(source.sourceId)),
        capabilities: {
          readOnly: true,
          scout: project.contract
            ? `/api/hunt?address=${project.contract}`
            : null,
          autonomous: false,
          spending: false,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    store.close();
  }
}
