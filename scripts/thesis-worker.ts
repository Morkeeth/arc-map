import { ThesisStore, checkThesis } from "../src/lib/thesis-store";
import { WorkerStatusStore } from "../src/lib/worker-status";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type EvidenceStatus = {
  lastSuccess: string | null;
  lastError: string | null;
  unresolvedChecks: string[];
};

export async function cycle(statusPath = resolve(".data/thesis-worker-status.json")) {
  let previous: EvidenceStatus = {
    lastSuccess: null,
    lastError: null,
    unresolvedChecks: [],
  };
  try {
    const saved = JSON.parse(readFileSync(statusPath, "utf8"));
    previous = {
      lastSuccess:
        typeof saved.lastSuccess === "string" ? saved.lastSuccess : null,
      lastError: typeof saved.lastError === "string" ? saved.lastError : null,
      unresolvedChecks: Array.isArray(saved.unresolvedChecks)
        ? saved.unresolvedChecks.filter(
            (id: unknown): id is string => typeof id === "string",
          )
        : [],
    };
  } catch (error) {
    // A missing first-run status is expected. Corrupt state must not look healthy.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const unresolved = new Set(previous.unresolvedChecks);
  const store = new ThesisStore();
  const workers = new WorkerStatusStore();
  let checked = 0,
    failed = 0;
  try {
    workers.attempt("theses");
    for (const item of store.due()) {
      try {
        await checkThesis(store, item.owner, item.id, true);
        // checkThesis persists provider errors instead of throwing them.
        const latest = store.checks(item.owner, item.id).at(-1);
        if (latest?.error || !latest?.sample) {
          failed++;
          unresolved.add(item.id);
        } else {
          checked++;
          unresolved.delete(item.id);
        }
      } catch {
        failed++;
        unresolved.add(item.id);
      }
    }
  } finally {
    store.close();
  }
  const at = new Date().toISOString();
  const status = {
    at,
    checked,
    failed,
    // A quiet scheduler tick says nothing about source recovery.
    cycle: failed ? "failed" : checked ? "checked" : "idle",
    lastSuccess:
      checked > 0 && unresolved.size === 0 ? at : previous.lastSuccess,
    lastError: unresolved.size
      ? `${unresolved.size} scheduled thesis source(s) remain unverified after failure.`
      : checked > 0
        ? null
        : previous.lastError,
    unresolvedChecks: [...unresolved],
    mode: "finite read-only thesis checks; no signing",
  };
  mkdirSync(dirname(statusPath), { recursive: true });
  writeFileSync(statusPath, JSON.stringify(status), { mode: 0o600 });
  // Supervisor UI reads WorkerStatusStore. Never mark theses successful while
  // unresolved source failures remain — same invariant as the JSON status file.
  try {
    if (unresolved.size > 0 || failed > 0) {
      workers.fail(
        "theses",
        status.lastError ||
          `${failed} thesis source check(s) failed this cycle.`,
        at,
      );
    } else if (checked > 0) {
      workers.success("theses", at);
    }
    // Idle with a clean history: leave prior success/failure untouched.
  } finally {
    workers.close();
  }
  console.log(JSON.stringify(status));
  return status;
}

async function main() {
  await cycle();
  if (process.argv.includes("--watch"))
    setInterval(
      () => void cycle().catch(() => console.error("Thesis worker cycle failed.")),
      60000,
    );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch(() => {
    console.error("Thesis worker stopped.");
    process.exitCode = 1;
  });
