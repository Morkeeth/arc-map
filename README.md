# ARC MAP
## Know what’s moving on Arc.

ARC MAP is an evidence-backed research workspace for Arc. Discover a contract or project,
ask a precise question, send a Hunter, and return to see what changed.

**Explore → investigate → inspect the evidence → follow the thesis.**

No wallet is needed to explore or run read-only research. This is an independent project,
not an official Circle ecosystem directory.

## What you can do

- **Today:** read grouped, source-linked leads with reasons to investigate, counterevidence
  and distinct event/observation dates. The ordering is explicit and rules-based.
- **Research inbox:** return to changed evidence, source failures/recoveries and ended monitoring.
  Quiet checks stay in history. Reading an update does not mark it reviewed.
- **Discover:** browse a live, bounded radar of token listings, verified-source contracts and
  sampled transactions, alongside sourced project profiles.
- **Investigate:** Distribution Hunter inspects transfers; Activity Hunter checks contract
  calls; Ship Hunter checks repository activity and exact release-publication claims.
- **Compare:** run a new investigation against a pinned report. Both original reports remain
  intact. Different sample counts are not presented as growth rates.
- **Follow:** save projects and review changes since your last explicit acknowledgment.
  Refreshing does not reset that baseline.
- **Track a thesis:** lock a claim, measurable criterion and deadline; schedule a finite number
  of read-only checks; inspect history, failures and attached Hunter evidence. Start an explicit
  new round with a fresh baseline pinned to the ended round; the original stays unchanged.
- **Use your agent:** the MCP interface exposes the same bounded research operations.
  It cannot sign, fund, trade or expand wallet permissions.

## Start locally

Requires Node 22. Use the checked-in lockfile.

```sh
npm ci
npm run dev
```

Open http://localhost:3107. In **three separate terminals**, run:

```sh
npm run ingest:watch
npm run radar:watch
npm run theses:watch
```

These commands are long-running workers, not three commands to paste into one foreground
terminal. The app reads persisted observations; refreshing the feed does not fetch every
provider again. Workers stop when their host stops.

Public-source discovery and explorer research need no API key. Copy `.env.example` to
`.env.local` only when configuring optional integrations. Never put a private key or server
secret in a `NEXT_PUBLIC_` variable.

For Graph research, configure `GRAPH_TRANSFERS_URL` for the schema in
[subgraphs/arcmap](subgraphs/arcmap/README.md). The deployed index covers SUN transfers;
it does **not** index every radar contract. Missing Graph access stays an explicit error,
never an explorer result relabeled as Graph.

## Try the product

1. Open Today, inspect a lead and choose Hunt this, or browse Discover for a sourced target.
2. Run a read-only Hunter and inspect its sample, event dates and original source links.
3. Follow the project. Open Changes later to inspect newly recorded observations.
4. Create a thesis with a specific rule. For counters, “increase by 1” means baseline + 1,
   not an absolute target of 1.
5. Return to the research inbox and open the exact thesis. Review its evidence history,
   start a new finite round, or rerun a Hunter against its original report.

For code projects, inspect the repository, choose an actual release tag and check whether it
has a published stable release. Publication is not proof that the network runs that version.

## Agents and reviewers

Start with [the agent and reviewer guide](docs/AGENT-GUIDE.md). It contains the tool map,
recommended research workflow, evidence rules and a code-reading path for judges and agents.
[AGENTS.md](AGENTS.md) is the separate contributor instruction file.

MCP endpoint: `POST /api/mcp` (Streamable HTTP, JSON responses).
Use a client's secure header configuration for the server's `ARCMAP_AGENT_TOKEN`.
Browser and bearer-token workspaces are separate. Do not publish bearer tokens in URLs,
examples, screenshots or checked-in client configuration.

## Verification

```sh
npm test
npm run typecheck
npm run build
npm run test:agent
npm run check:integrations
node --import tsx scripts/test-daily-flow.ts
```

The live agent protocol test requires the app on port 3107 and access to its public providers.
It creates isolated research records, not financial transactions.

With Foundry installed:

```sh
npm run test:contracts
npm run test:strategy
npm run test:lifecycle
```

The lifecycle command runs a separate **local Anvil chain**. It does not authorize or execute
an Arc transaction. `ANVIL_BIN` can override the executable path.

A local production restore test is available after a build:

```sh
node --import tsx scripts/test-restore.ts
```

See [verification evidence](docs/VERIFICATION.md) for the tested revision scope and limitations.

## Integration status

| Integration | Implemented evidence | Remaining |
| --- | --- | --- |
| Arc | Testnet escrow runtime verified; operator-controlled 0.05 USDC research lifecycle completed, 0.01 fee and 0.04 refund | Privy browser payment verification; separately reviewed mainnet deployment |
| The Graph | Published SUN transfer subgraph and live Hunter queries, index freshness checks | Broader indexed contract coverage |
| Privy | Wallet connection UI and wallet-approved payment preparation | Authenticated browser funding, cancellation and refund verification |
| GitHub | Sourced repository commits, exact release investigations and pinned comparisons | Wider verified project associations |
| X | Not connected | Verified read access and an approved request budget |

A separate Cursor agent used live Graph research and requested a finite thesis check. Its
first counter rule was wrong; after the interface exposed the resolved criterion, it detected
the mismatch and replaced the thesis without rewriting history. The later check ran.
This is a narrow, recorded evaluation—not proof of general autonomous-agent reliability.

## Data, privacy and limits

- Radar retains at most 1,000 observed contracts from bounded source pages. They are not
  1,000 verified projects or launches.
- Holder addresses are not people. First observed is not first launched. Repository commits
  and releases are not network deployments.
- Event timestamps, source-query timestamps and index freshness are distinct.
- Research analysis is rules-based. An external agent can select and interpret tools; the
  app is not an autonomous investment manager.
- Private follows, missions and theses use a browser-workspace cookie. Clearing it loses
  access; there is no account recovery or cross-device sync yet.
- SQLite state lives in ignored `.data/`. Use persistent storage, not an ephemeral filesystem.
  `npm run backup` creates local snapshots. Do not publish these databases.
- Research fees are not investment shares. Strategy contracts are **local-only, unaudited
  sandbox code**. No investment token or mainnet strategy is live.

## What comes next

Persistent public beta and domain; authenticated account recovery and shared research;
verified Privy payments; richer sourced project narratives and X ingestion; broader Graph
coverage; and mainnet security/operational readiness. See
[launch operations](docs/LAUNCH-OPERATIONS.md) for current deployment boundaries.

## Architecture and provenance

- [Architecture](docs/ARCHITECTURE.md)
- [Hunter execution and payment boundaries](docs/HUNTER-EXECUTION.md)
- [Decisions and code origin](docs/DECISIONS.md)
- [Sponsor implementation requirements](docs/SPONSORS.md)

Application implementation was AI-assisted from the participant's product direction.
Dependencies are recorded in lockfiles. No competition eligibility, prize qualification,
security audit or public-host deployment is implied by this repository.
