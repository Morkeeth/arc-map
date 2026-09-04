import { RadarStore } from "../src/lib/radar-store";
import { ingestRadar } from "../src/lib/radar-ingest";
async function cycle() {
  const store = new RadarStore();
  try { console.log(JSON.stringify({ at: new Date().toISOString(), ...(await ingestRadar(store)), catalog: store.list().length, sources: store.health() })); }
  finally { store.close(); }
}
async function main() {
  await cycle();
  if (process.argv.includes("--watch")) setInterval(() => void cycle().catch(() => console.error("Radar cycle failed; previous records retained.")), 300000);
}
main().catch(() => { console.error("Radar stopped."); process.exitCode = 1; });
