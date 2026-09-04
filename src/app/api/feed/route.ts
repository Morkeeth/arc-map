import { FeedStore } from "@/lib/feed-store";
import { projects } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const since = new URL(request.url).searchParams.get("since");
  if (since && !Number.isFinite(Date.parse(since)))
    return Response.json(
      { error: "since must be an ISO timestamp" },
      { status: 400 },
    );
  const store = new FeedStore();
  try {
    return Response.json(
      {
        projects,
        events: store
          .events()
          .filter(
            (event) =>
              !since || Date.parse(event.observedAt) > Date.parse(since),
          ),
        sources: store.health(),
        generatedAt: new Date().toISOString(),
        coverage:
          "Curated Arc catalog. Tracks the latest default-branch commit for two repositories and SUN explorer counters. Not all Arc activity. X ingestion is not connected. Up to 200 recent observations of changes are returned.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    store.close();
  }
}
