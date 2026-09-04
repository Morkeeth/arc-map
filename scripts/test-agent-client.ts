import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  // A fresh, isolated local session. Never uses or prints the user's browser cookie.
  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost:3107/api/mcp"),
    {
      requestInit: {
        headers: {
          Origin: "http://localhost:3107",
          Cookie: `arcmap_session=${randomBytes(32).toString("hex")}`,
        },
      },
    },
  );
  const client = new Client({
    name: "arcmap-integration-client",
    version: "0.1.0",
  });
  try {
    await client.connect(transport);
    const catalog = await client.listTools();
    for (const name of ["discover_projects", "search_radar", "integration_readiness", "create_research_mission", "run_research_mission", "get_research_mission"])
      assert.ok(catalog.tools.some(t => t.name === name));
    async function call(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args });
      const content = result.content as { type: string; text?: string }[];
      return {
        error: result.isError === true,
        data: JSON.parse(content.find((c) => c.type === "text")!.text!),
      };
    }
    const discovery = await call("discover_projects");
    const radar = await call("search_radar", { kind: "contract" });
    assert.equal(radar.error, false);
    const ship = await call("inspect_repository", { projectId: "arc-node" });
    assert.equal(ship.error, false);
    assert.ok(ship.data.repository.commits.length > 0);
    const thesis = await call("create_thesis", { projectId: "arc-node", claim: "The default branch head will change within eight hours.", metric: "repository-head", threshold: 1, hours: 8, intervalMinutes: 30, checks: 2 });
    assert.equal(thesis.error, false);
    try {
      const checked = await call("check_thesis", { id: thesis.data.thesis.id });
      assert.equal(checked.error, false);
      const history = await call("get_thesis", { id: thesis.data.thesis.id });
      assert.equal(history.error, false);
      assert.equal(history.data.thesis.commitment, thesis.data.thesis.commitment);
      assert.equal(history.data.checks.length, 1);
    } finally {
      const cancelled = await call("cancel_thesis", { id: thesis.data.thesis.id });
      assert.equal(cancelled.error, false);
    }
    assert.ok(
      discovery.data.projects.some((p: { id: string }) => p.id === "sun-token"),
    );
    const created = await call("create_research_mission", {
      projectId: "sun-token",
      provider: "explorer",
      budget: "0.05",
    });
    assert.equal(created.error, false);
    const executed = await call("run_research_mission", {
      id: created.data.mission.id,
    });
    assert.equal(executed.error, false);
    assert.equal(executed.data.mission.status, "reported");
    const saved = await call("get_research_mission", {
      id: created.data.mission.id,
    });
    assert.equal(
      saved.data.mission.reportHash,
      executed.data.mission.reportHash,
    );
    console.log(
      JSON.stringify(
        {
          protocol: "MCP Streamable HTTP",
          tools: catalog.tools.map((t) => t.name),
          source: saved.data.mission.report.provider,
          sampledEvents: saved.data.mission.report.sampleSize,
          distinctTransactions: saved.data.mission.report.transactions,
          proofs: [
            "official SDK handshake",
            "tool discovery",
            "curated project discovery",
            "mission creation",
            "live research execution",
            "persisted report retrieval",
            "live radar search and repository inspection",
            "thesis baseline, check, retrieval and cancellation",
          ],
          limitation:
            "Protocol integration test, not a separate LLM evaluation. No wallet action or Graph query was substituted.",
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Agent client failed");
  process.exitCode = 1;
});
