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

```sh
npm test
npm run typecheck
npm run build
```

## First working slice

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

Live Graph indexing; project discovery beyond ERC-20 listings; durable change detection;
shared watchlists; agent-selected investigation steps; MCP support; Privy-backed mission budgets
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
