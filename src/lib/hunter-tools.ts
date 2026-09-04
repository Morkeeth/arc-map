import { hunters } from "./hunters";
import { projects } from "./projects";
import { FeedStore } from "./feed-store";
import { MissionStore } from "./mission-store";
import { runHunter } from "./hunter-runner";

export const hunterTools = [
  {
    name: "discover_projects",
    description:
      "Read curated Arc projects and sourced observations. First observed is not first launched. No trades.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_hunters",
    description:
      "Read Hunter mandates, tools and boundaries. No investment shares or autonomous trading are available.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "create_research_mission",
    description:
      "Save a private research mission with a proposed testnet budget. No funds move. Select the evidence provider explicitly; do not silently substitute providers.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", enum: ["sun-token"] },
        provider: { type: "string", enum: ["graph", "explorer"] },
        budget: {
          type: "string",
          description:
            "0.01 to 10 testnet USDC; a proposal, not spending authorization.",
        },
      },
      required: ["projectId", "provider", "budget"],
      additionalProperties: false,
    },
  },
  {
    name: "run_research_mission",
    description:
      "Run a saved mission against its selected live data source and commit a report hash. No onchain action. Reported missions are immutable; create a new one for fresh evidence.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_research_mission",
    description:
      "Read a private mission, source evidence, limitations and report commitment. A report hash is not proof of onchain settlement.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
];
export async function callHunterTool(
  owner: string,
  name: string,
  args: Record<string, unknown>,
) {
  if (name === "list_hunters") return { hunters };
  if (name === "discover_projects") {
    const feed = new FeedStore();
    try {
      return { projects, observations: feed.events(), sources: feed.health() };
    } finally {
      feed.close();
    }
  }
  if (!hunterTools.some((t) => t.name === name))
    throw new Error("Unknown tool.");
  const store = new MissionStore();
  try {
    if (name === "create_research_mission")
      return { mission: store.create(owner, args) };
    if (typeof args.id !== "string") throw new Error("Mission id is required.");
    const mission = store.get(owner, args.id);
    if (!mission) throw new Error("Mission not found.");
    if (name === "get_research_mission") return { mission };
    const claimed = store.claim(owner, args.id);
    try {
      return {
        mission: store.finish(owner, args.id, await runHunter(claimed), null),
      };
    } catch (error) {
      return {
        mission: store.finish(
          owner,
          args.id,
          null,
          error instanceof Error ? error.message : "Research failed.",
        ),
      };
    }
  } finally {
    store.close();
  }
}
