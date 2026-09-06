import { FeedStore } from "../src/lib/feed-store";
import { ingest } from "../src/lib/ingest";
import { WorkerStatusStore } from "../src/lib/worker-status";

async function cycle() {
  const store = new FeedStore();
  const status = new WorkerStatusStore();
  try {
    status.attempt("ingest");
    const result = await ingest(store);
    const sources = store.health();
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        ...result,
        sources,
      }),
    );
    if (result.skipped) {
      status.fail(
        "ingest",
        "Lease held elsewhere; cycle skipped (freshness not advanced).",
      );
      return;
    }
    const errored = sources.filter((s) => s.error);
    if (errored.length) {
      status.fail(
        "ingest",
        `${errored.length} source(s) failed this cycle; freshness not advanced.`,
      );
      return;
    }
    status.success("ingest");
  } catch (error) {
    status.fail(
      "ingest",
      error instanceof Error ? error.message : "Ingestion failed.",
    );
    throw error;
  } finally {
    store.close();
    status.close();
  }
}

function watchIntervalMs() {
  const raw = process.env.ARCMAP_INGEST_INTERVAL_MS;
  if (raw == null || raw === "") return 300_000;
  const ms = Number(raw);
  if (!Number.isFinite(ms) || ms < 1_000) {
    throw new Error("ARCMAP_INGEST_INTERVAL_MS must be at least 1000.");
  }
  return ms;
}

void (async () => {
  await cycle();
  if (process.argv.includes("--watch"))
    setInterval(() => {
      void cycle().catch((error) =>
        console.error("Ingestion failed:", error.message),
      );
    }, watchIntervalMs());
})().catch((error) => {
  console.error("Ingestion failed:", error.message);
  process.exitCode = 1;
});
