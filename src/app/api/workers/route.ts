import { WorkerStatusStore, workerFreshness, summarizeWorkers } from "@/lib/worker-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = new WorkerStatusStore();
  try {
    const now = Date.now();
    const workers = store.listExpected().map((worker) => ({
      ...worker,
      freshness: workerFreshness(worker, now),
    }));
    return Response.json(
      {
        generatedAt: new Date(now).toISOString(),
        workers,
        summary: summarizeWorkers(workers),
        note: "Freshness is based on the last completed local source cycle. Missing or failed workers never become a fresh story.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    store.close();
  }
}
