# Hunter execution — implemented boundaries

## Product

ARC MAP discovers projects. Hunters investigate explicit theses using indexed evidence.
The target is a funded, accountable agent loop; strategy backing comes after paid research.
This build implements one rules-based Distribution Hunter, not an LLM portfolio manager.

The working app starts with projects and source observations, not a marketing hero. Select
a project, inspect its evidence, run a research mission, and review the result. The chosen
provider is part of the immutable thesis commitment. Missing Graph access produces a blocked
mission, never an explorer result presented as Graph data.

## Research

The Graph transfer adapter queries the actual `subgraphs/arcmap/schema.graphql` schema.
`GRAPH_TRANSFERS_URL` is separate from the older token-discovery `GRAPH_SUBGRAPH_URL`.
It checks indexing errors, indexed block, token association, event hashes and numeric fields.
The sample is capped at 200 events; a 201st row indicates continuation. An empty sample is
not proof of inactivity. Up to eight example events are retained alongside aggregate counts.

The preview tests one narrow thesis: whether sampled activity extends beyond a single
transaction. It does not establish unique humans, sustained adoption, fraud or investment value.
The explorer preview is free and cannot unlock the Graph-backed funding path.

Private missions persist in `.data/missions.sqlite`. A 256-bit HttpOnly SameSite cookie
identifies a browser workspace. This is not wallet authentication or cross-device account sync.
Agent bearer tokens identify a separate workspace. Reads are owner-scoped. Research mutations
require the configured origin or bearer token. Five attempts per owner per minute and 120
attempts globally per hour limit upstream consumption. Each mission has an execution lease;
successful reports cannot be overwritten. New evidence requires a new mission.

## Payment contract

`contracts/src/HunterEscrow.sol` is a native-currency, fixed-fee research escrow. It is not
a pooled investment vault, fungible Hunter token, NFT or profit-sharing contract.
Construction is restricted to Arc testnet (5042002) or local Anvil (31337).
Arc's native USDC uses 18 decimal base units in the installed viem chain definition. This
contract does not use the separate ERC-20 USDC interface or its decimal representation.

1. The user reviews a completed Graph preview and the proposed mission terms.
2. The server checks chain ID, runtime code hash, current chain state and recent indexed data,
   then simulates a precisely encoded transaction. The wallet must approve the transaction.
3. `openMission` locks the budget, executor, payee, fee, deadline, thesis hash and expected
   report hash. The application fee is a chosen 0.01 testnet USDC, not a measured market price.
   The application and contract cap a mission budget at 10 native USDC.
4. The executor can collect the fixed fee once, only for the expected report hash and before
   the deadline. It cannot redirect the payment, increase the fee or submit different content.
5. The owner can cancel an uncompleted mission or reclaim surplus after settlement. Failed
   external payments revert state; a reentrancy guard protects settlement and withdrawal.

A matching hash proves a commitment to specific bytes, not that the report is correct. This
prototype exposes the research before payment; it is not a confidential paid-data service.
The broader pre-funded research workflow requires a distinct result-approval/dispute design.
The report commitment is keccak256 of the UTF-8 `JSON.stringify(report)` result, preserving
the stored property order. It is not a canonical-JSON interoperability claim.

## Executor

`npm run hunter:settle -- /absolute/path/to/private-mission.json` simulates settlement.
The input is the owner-authorized `/api/missions/:id` response. Treat it as private data.
`--broadcast` is an explicit operator action. It uses a separately configured executor key,
never the user's saved wallet key. It checks the signer address, escrow code, chain, mandate,
fee and report commitment. Estimated gas is capped at 0.1 testnet USDC. No worker starts
automatically and no public HTTP route can invoke this signer.

Environment fields are in `.env.example`. The Graph deploy key is not a query API key.
Do not copy the user's wallet credential into app hosting, JavaScript bundles or this repo.

## Agent access

`POST /api/mcp` implements stateless MCP Streamable HTTP with JSON responses. It supports
initialization, ping, tool discovery and tool calls. There is no SSE subscription.
Use an MCP client's secure header configuration for `Authorization: Bearer <ARCMAP_AGENT_TOKEN>`;
never put the token in a URL or checked-in config. Available tools:

- `discover_projects`: curated profiles, observations and source health.
- `list_hunters`: the actual mandate and limitations.
- `create_research_mission`: private record and proposed budget; no payment.
- `run_research_mission`: live provider query, analysis and content commitment.
- `get_research_mission`: retrieve the saved result.

No MCP tool signs, funds, trades or changes spending permissions. Source text is untrusted
data, never agent instructions. The official MCP SDK test runs discovery → create → research
→ retrieval, with live explorer data. It is a protocol test, not an independent LLM evaluation.

## Verification commands

Use Node 22 and Foundry on PATH.

```sh
npm test
npm run typecheck
npm run build
npm run test:contracts
npm run test:lifecycle
npm run test:agent
npm run check:integrations
```

`test:lifecycle` starts its own isolated Anvil process, uses only unlocked local test accounts,
queries live explorer evidence, deploys the actual compiled contract, funds a mission, checks
the payment event and matching report hash, rejects unauthorized/duplicate settlement, and
reclaims the surplus. Its transactions are **local**, not Arc testnet receipts.
`test:agent` requires the local app at port 3107 and creates an isolated private test session.

## Live launch checkpoints still open

Production packaging is prepared in `Dockerfile` and `compose.yaml`: a non-root web process
and a separate collector share a persistent data volume. No wallet private key is passed to
either service. Bind a reverse proxy/TLS endpoint deliberately; the provided port binds only
to localhost:3117. Set the trusted app origin at image build time. `docker compose config`
validates, but the Docker daemon was unavailable during this run, so the image build and
container lifecycle are not verified. No hosting service was provisioned.
The standalone Node production server was separately started and its primary pages and APIs
returned 200. That confirms the Node build runs, not that a container or public host was tested.

Dependency audit at this build: the application has 10 moderate advisories and no high or
critical advisories after targeted transitive updates. The separate Graph developer-tool
package still has 5 moderate, 10 high and 1 critical advisory from the earlier setup. These
are unresolved release risks, not a security clearance; no forced downgrade was applied.

- Authorize and deploy the subgraph to Studio; query its hosted endpoint and verify coverage.
- Authorize the capped Arc testnet contract deployment and complete the real payment lifecycle.
- Authenticate a Privy wallet and verify funding/cancellation through the actual browser flow.
- Run a separate AI client against the MCP tools and inspect its reasoning and misuse cases.
- Set up a persistent host, database backups and source worker. No public deployment exists.
- Replace browser-only mission identity with verified account ownership and scoped agent access
  before shared user/agent workflows; add abuse controls suitable for a public multiuser service.
- Resolve or explicitly assess remaining wallet dependency advisories; obtain independent
  contract/security review. This code is not cleared to hold real funds.
- Mainnet requires a separately reviewed deployment/version. Do not remove the testnet guard
  and call that readiness. Investment shares, custody/withdrawal rules and jurisdiction-specific
  review are a separate product phase.
