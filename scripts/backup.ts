import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

// Local snapshots only. No secret files, release records, wallet exports or uploads.
// VACUUM INTO includes committed WAL contents; copying only a live .sqlite file does not.
// Include worker-status so restore never invents an empty "all live" panel.
const sources = ["arcmap.sqlite", "radar.sqlite", "missions.sqlite", "theses.sqlite", "worker-status.sqlite"];
const destination = resolve(".data/backups", new Date().toISOString().replaceAll(":", "-"));
mkdirSync(destination, { recursive: true, mode: 0o700 });
for (const name of sources) {
  const source = resolve(".data", name);
  if (!existsSync(source)) continue;
  const target = join(destination, name);
  const db = new DatabaseSync(source);
  try { db.exec("PRAGMA busy_timeout=5000"); db.prepare("VACUUM INTO ?").run(target); }
  finally { db.close(); }
  chmodSync(target, 0o600);
  const restored = new DatabaseSync(target, { readOnly: true });
  try {
    const check = restored.prepare("PRAGMA integrity_check").get();
    if (check?.integrity_check !== "ok") throw new Error(`Snapshot failed integrity check: ${name}`);
  } finally { restored.close(); }
  console.log(JSON.stringify({ database: name, snapshotVerified: true }));
}
console.log("Local snapshot stored under ignored .data/backups. Treat mission and thesis copies as private.");
