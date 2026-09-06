import { RadarStore } from "../src/lib/radar-store";
import { ingestRadar } from "../src/lib/radar-ingest";
import { WorkerStatusStore } from "../src/lib/worker-status";

async function cycle() {
  const store = new RadarStore();
  const status = new WorkerStatusStore();
  try {
    status.attempt("radar");
    const result = await ingestRadar(store);
    const sources = store.health();
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        ...result,
        catalog: store.list().length,
        sources,
      }),
    );
    if (
      result &&
      typeof result === "object" &&
      "skipped" in result &&
      result.skipped
    ) {
      status.fail(
        "radar",
        "Lease held elsewhere; cycle skipped (freshness not advanced).",
      );
      return;
    }
    const errored = sources.filter((s) => s.error);
    if (errored.length) {
      status.fail(
        "radar",
        `${errored.length} source(s) failed this cycle; freshness not advanced.`,
      );
      return;
    }
    status.success("radar");
  } catch (error) {
    status.fail(
      "radar",
      error instanceof Error ? error.message : "Radar cycle failed.",
    );
    throw error;
  } finally {
    store.close();
    status.close();
  }
}

async function main() {
  await cycle();
  if (process.argv.includes("--watch"))
    setInterval(
      () =>
        void cycle().catch(() =>
          console.error("Radar cycle failed; previous records retained."),
        ),
      300000,
    );
}

main().catch(() => {
  console.error("Radar stopped.");
  process.exitCode = 1;
});
