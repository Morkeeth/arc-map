import { projects } from "./projects";
import { FeedStore } from "./feed-store";
import { asCount } from "./analysis";
import type { Observation } from "./feed-types";

async function get(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "arcmap-research-preview",
    },
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  return response.json();
}

export async function ingest(
  store: FeedStore,
  fetchJson = get,
): Promise<{ checked: number; inserted: number; skipped: boolean }> {
  if (!store.acquireLease()) return { checked: 0, inserted: 0, skipped: true };
  let checked = 0,
    inserted = 0;
  await Promise.all(
    projects.flatMap((project) => {
      const tasks: {
        sourceId: string;
        url: string;
        read: (data: unknown) => Omit<Observation, "observedAt">;
      }[] = [];
      if (project.repo)
        tasks.push({
          sourceId: `github:${project.repo}`,
          url: `https://api.github.com/repos/${project.repo}/commits?per_page=1`,
          read: (data) => {
            const commit = Array.isArray(data) ? data[0] : null;
            if (
              !commit ||
              !/^[a-f0-9]{40}$/i.test(commit.sha) ||
              typeof commit.commit?.message !== "string"
            )
              throw new Error("Unexpected commit response");
            const eventAt = commit.commit.committer?.date;
            if (
              typeof eventAt !== "string" ||
              !Number.isFinite(Date.parse(eventAt))
            )
              throw new Error("Invalid commit timestamp");
            return {
              projectId: project.id,
              sourceId: `github:${project.repo}`,
              kind: "code",
              sourceUrl: `https://github.com/${project.repo}/commit/${commit.sha}`,
              eventAt: new Date(eventAt).toISOString(),
              payload: {
                commit: commit.sha,
                message: commit.commit.message.split("\n")[0].slice(0, 180),
              },
            };
          },
        });
      if (project.contract)
        tasks.push({
          sourceId: `arc-testnet:${project.contract.toLowerCase()}`,
          url: `https://testnet.arcscan.app/api/v2/tokens/${project.contract}/counters`,
          read: (data) => {
            const item = data as Record<string, unknown>;
            if (
              !item ||
              !("token_holders_count" in item) ||
              !("transfers_count" in item)
            )
              throw new Error("Unexpected counter response");
            return {
              projectId: project.id,
              sourceId: `arc-testnet:${project.contract!.toLowerCase()}`,
              kind: "onchain",
              sourceUrl: `https://testnet.arcscan.app/api/v2/tokens/${project.contract}/counters`,
              eventAt: null,
              payload: {
                holders: asCount(item.token_holders_count),
                transfers: asCount(item.transfers_count),
              },
            };
          },
        });
      return tasks.map(async (task) => {
        const observedAt = new Date().toISOString();
        try {
          const observation = task.read(await fetchJson(task.url));
          if (store.record({ ...observation, observedAt })) inserted++;
        } catch (cause) {
          store.fail(
            task.sourceId,
            observedAt,
            cause instanceof Error ? cause.message : "Source unavailable",
          );
        }
        checked++;
      });
    }),
  );
  return { checked, inserted, skipped: false };
}
