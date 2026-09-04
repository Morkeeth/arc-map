import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { probeIntegrations } from "../src/lib/integration-health";
// Match local app configuration; never print provider URLs or signer details.
if (existsSync(".env.local")) {
  const local = parseEnv(readFileSync(".env.local", "utf8"));
  for (const [key, value] of Object.entries(local)) process.env[key] ??= value;
}
probeIntegrations().then((result) => console.log(JSON.stringify(result, null, 2))).catch(() => {
  console.error("Integration check failed. Credentials were not logged.");
  process.exitCode = 1;
});
