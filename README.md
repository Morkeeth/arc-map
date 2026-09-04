# ARC MAP

**Find your next rabbit hole.**

Explore what's happening on Arc, follow the stories, and send a hunter after the questions
that matter. The map creates questions; hunters bring back evidence.

## Run locally

```sh
nvm use
npm install
npm run dev
```

Requires Node 22 (see .nvmrc). Open http://localhost:3107. No keys or wallet connection are needed for this first slice.

In a second terminal, start the source collector:

```sh
npm run ingest:watch
```

It checks the curated GitHub/Arcscan sources every five minutes. `npm run ingest` performs one
check. A database lease limits ingestion to once per minute across local processes. The feed API
only reads stored data; refreshing the page does not trigger upstream calls. The worker must
remain running; this is not yet a hosted scheduler that works with the laptop closed.

Public source observations persist in `.data/arcmap.sqlite` (ignored by git). Override the path
with `ARCMAP_DB_PATH` for a persistent host volume. This uses Node 22's experimental built-in
SQLite support. Do not deploy it on ephemeral storage or copy wallet credentials into this database.

```sh
npm test
npm run typecheck
npm run build
```

## First working slice

- **Today on Arc** at `/`: stored source observations, project search, filters and reading position.
- Four curated project profiles at `/projects/:id`, with explicit evidence for source associations.
- Real GitHub default-branch commit observations for Arc node and Circle Agent Stack; SUN counter
  baselines and changes from Arcscan. Source event time and retrieval time remain distinct.
- Persistent SQLite observations, duplicate protection, source-health checks and outage recovery.
- Per-browser project follows and a Following feed. No shared accounts or cross-device sync yet.
- Read-only agent routes: `/api/feed`, `/api/feed?since=<ISO timestamp>`, `/api/projects/:id`.
  Usage and limitations are visible at `/agents`. These are HTTP routes, not MCP yet.
- A token atlas fetched from the Arc testnet explorer, with search and metadata-based districts.
- Field notes that distinguish observed counts from open investigation questions.
- A per-browser token watchlist. There is no account sync or background monitoring yet.
- **Hunt this** runs a fixed, read-only scout against the latest returned transfer page. It reports
  sender/recipient counts, repeated senders, event time and source transactions, with sample limits.
- A read-only JSON scout endpoint for agents: `/api/hunt?address=0x...`.
- An optional Graph discovery adapter with an explicit schema contract. It is not deployed.
- A separate [Graph transfer index](subgraphs/arcmap/README.md), initialized for Studio slug
  `arcmap` on Arc Testnet. It is not deployed or connected to the hunter yet.

The atlas is a discovery layout, not a geographic map or a measured wallet relationship graph.
Only a bounded set of tokens is shown. Token labels and category names do not establish official
protocol deployments. A current fetch may contain old events.

## Next product capabilities

Live Graph indexing; broader source/project coverage; X ingestion; shared watchlists;
agent-selected investigation steps; MCP support; Privy-backed mission budgets
and real USDC payments on Arc. These are planned, not working capabilities of this kickoff.

The first customers are two people already watching Arc for useful projects and ideas. The
product should help them answer: what changed, why might it matter, and what should we investigate?

## Product and engineering record

- [Brand direction](docs/BRAND.md)
- [Architecture and next proofs](docs/ARCHITECTURE.md)
- [Sponsor decision](docs/SPONSORS.md)
- [Decision and origin record](docs/DECISIONS.md)

## Data and secrets

The default source is https://testnet.arcscan.app/api/v2. No personal wallet data is imported.
Do not commit API keys or provider URLs containing keys. Copy `.env.example` to `.env.local` for
local configuration. Configuring the Graph adapter replaces discovery; it never silently falls
back to explorer data under a Graph label. Scouts currently always use the explorer.

This kickoff is a local development application. Public hosting needs persistent rate limiting,
authentication and worker isolation for agent workloads before paid or autonomous hunts are enabled.

## Verification — 2026-09-04

Eleven evidence/store tests, TypeScript and the production build pass. A live ingestion run
successfully checked all three configured sources and stored three initial feed entries. HTTP
checks exercised Today, map, project and agent pages; unknown projects returned 404, invalid
feed timestamps returned 400. The feed → project → advertised scout route returned 50 SUN
transfer events across one sampled transaction. This was a direct API check, not an autonomous
agent evaluation. Browser automation was unavailable, so visual and click-through QA remain open.
