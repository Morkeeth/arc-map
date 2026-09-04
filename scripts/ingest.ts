import { FeedStore } from "../src/lib/feed-store";
import { ingest } from "../src/lib/ingest";

async function cycle() {
  const store = new FeedStore();
  try {
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        ...(await ingest(store)),
        sources: store.health(),
      }),
    );
  } finally {
    store.close();
  }
}
void (async () => {
  await cycle();
  if (process.argv.includes("--watch"))
    setInterval(() => {
      void cycle().catch((error) =>
        console.error("Ingestion failed:", error.message),
      );
    }, 300_000);
})().catch((error) => {
  console.error("Ingestion failed:", error.message);
  process.exitCode = 1;
});
