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
    assert.equal(catalog.tools.length, 5);
    async function call(name: string, args: Record<string, unknown> = {}) {
      const result = await client.callTool({ name, arguments: args });
      const content = result.content as { type: string; text?: string }[];
      return {
        error: result.isError === true,
        data: JSON.parse(content.find((c) => c.type === "text")!.text!),
      };
    }
    const discovery = await call("discover_projects");
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
