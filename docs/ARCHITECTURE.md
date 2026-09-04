# Architecture and next proofs

## Current boundaries

Next.js App Router, React, TypeScript, Lucide. npm lockfile pins resolved dependencies.

```text
Today / project profile / browser project follows
    GET /api/feed and GET /api/projects/:id
        SQLite observations + events + source health
    separate npm run ingest:watch process
        public GitHub latest commits + Arcscan SUN counters
        five-minute polling, cross-process lease, persistent history
Browser atlas / field note / token watchlist at /map
    GET /api/discover
        Graph adapter if explicitly configured
        otherwise Arcscan explorer token listings
    GET /api/hunt?address=...
        fixed scout → explorer counters + latest transfer page
        pure analysis → bounded findings with source transactions
```

Follow lists and reading position are local browser state. The scout is a fixed evidence check,
not an autonomous LLM. Four curated project profiles and a local ingestion worker are implemented.
No paid flow, wallet signing, MCP transport, X ingestion or hosted scheduler is implemented.
The feed reads SQLite and does not perform upstream requests. The local worker stops when its
process or machine stops; production needs a persistent volume and hosted scheduler/worker.

Both upstream calls have timeouts. Token addresses are validated; client input cannot choose an
upstream host. Missing or unsafe integer counters become unknown, not zero. Reports deduplicate
events by transaction hash and log index. All remote labels render as text, not HTML.

## Graph adapter contract

`GRAPH_SUBGRAPH_URL` must expose a `tokens` entity query ordered by `holderCount`, with fields
`id` (ERC-20 contract address), `name`, `symbol`, `holderCount`, and `_meta` indexing status.
This is a proposed ARC MAP schema, not an assertion that an existing subgraph implements it.
`GRAPH_API_KEY` may supply bearer authentication. Keep provider URLs out of public API responses.

An accurate holder count requires processing balances and transitions through zero; a transfer
count alone is not sufficient. Index coverage, start block, head block and indexing lag must be
stored and shown before Graph becomes the default provider.

## Launch-first build plan — user ruling

Primary goal: launch quickly so people can keep track of what is happening on Arc.
The product ambition remains discovery + narratives + THE HUNT. Sponsor integrations support
that product; paid hunts are not a dependency for a useful public read-only release.

User experience: Today on Arc → project or signal → inspect evidence → follow → return to changes.
The map is an exploration view, not the only entrance. The first users are the founder and coworker.
The return-visit test is whether they can see a meaningful, sourced change since their last visit.

Build locally without repeated approval for ordinary implementation. Check in at completed slices.
Do not imply a background build is active when no worker is running. Ask at actual authority forks:
hosting account or spend, public deployment/push, wallet signing, paid APIs, and external messages.

### Release A — useful public Arc tracker

- [ ] **1. Project discovery beyond the holder leaderboard**
  Spec ref: Current boundaries; Evidence rules.
  What to build: Explicit project records with verified websites, contracts, category, chain,
  source links and discovery timestamps; combine onchain observations with curated public announcements.
  Acceptance: A person can open a real project, see what it does, and verify each claimed
  contract/site association. Unverified associations remain labeled; first-seen is not launch date.
  Verify: Check the launch catalog against its primary sources and include missing/conflicting
  metadata cases. Do not label an ERC-20 name as an official protocol deployment.

- [ ] **2. Persistent ingestion and change history**
  Spec ref: Evidence rules.
  What to build: A durable store, scheduled ingestion and immutable observation snapshots;
  idempotent event ingestion; source-specific cursors, coverage and last-success timestamps.
  Acceptance: Restart does not erase history. Duplicate fetches do not create duplicate changes.
  Source failure, stale data, zero change and no baseline are distinct states.
  Verify: Ingest two real snapshots, repeat one, restart, induce an upstream failure and recover.
  Pin baseline timestamps in tests. Choose deployment database and scheduler with hosting.

- [ ] **3. Today on Arc**
  Spec ref: Launch-first user experience.
  What to build: Sourced cards for newly discovered projects, measured activity changes,
  announcements and questions worth investigating. Provide category and time filters.
  Acceptance: Every card links to a project or primary source and explains why it is shown.
  Claimed time-window changes require adequate historical coverage; no made-up 24-hour deltas.
  Verify: Trace displayed cards to stored observations; test empty, first-baseline and stale states.
  Judge usefulness against real tracked projects, not fixtures designed to flatter the ranking.

- [ ] **4. Project pages and following**
  Spec ref: Launch-first user experience.
  What to build: Stable project URLs, source-linked timelines, relevant contract activity and
  watchlists. Launch anonymous browser follows first; add account sync when ready.
  Acceptance: Reload preserves follows; returning shows newly observed changes for followed
  projects. Local-only state is labeled. A public project link works without a wallet.
  Verify: Cold browser → discover → inspect source → follow → reload → inspect subsequent change.
  Verify history persists independently of the browser session.

- [ ] **5. Meme-friendly design and shareable evidence**
  Spec ref: docs/BRAND.md.
  What to build: Light-blue, single-font Today/map/project views; collectible project markers;
  a distinctive blue scout; concise story headlines; public links with source-backed preview cards.
  Acceptance: The joke comes from the observation, not an unsupported accusation. Key numbers
  carry source and coverage. Mobile reading and primary actions are usable without zoom.
  Verify: Render and inspect actual desktop/mobile screens; test overflow, keyboard focus,
  loading and error states. Do not mark visual QA passed without a browser session.

- [ ] **6. THE HUNT, read-only at launch**
  Spec ref: Current boundaries; Graph adapter contract.
  What to build: A project-scoped investigation collecting transfers and source evidence,
  comparing relevant windows where covered, and returning a structured finding with caveats.
  Acceptance: Users can investigate from a feed card or project page and inspect its sources.
  Expose actual capability honestly: fixed scout until an AI agent really chooses investigation steps.
  Verify: Run against live contracts and independently verify transaction/log identities.
  Exercise provider timeout, partial history, duplicate events and contradictory evidence.

- [ ] **7. Public beta deployment and operational checks**
  Spec ref: Public launch boundary.
  What to build: Production hosting, durable scheduled ingestion, API caching, bounded request
  budgets/rate limits, monitoring, source-status UI and restart/recovery runbook.
  Acceptance: A stranger can use the tracker with no local setup, key or wallet. Updates continue
  with the developer laptop closed. Source outages are visible; keys never reach client bundles.
  Verify: Cold mobile flow on the actual public deployment; scheduled ingestion across repeated
  runs; induced outage/recovery; inspect outbound assets and tracked files for secrets.
  Boundary: Confirm hosting account, budget and publish authorization before deployment.
  Do not wait for paid hunts or all sponsor integrations to reach this release.

### Release B — deeper investigations and sustainable product

- [ ] **8. Live Graph-backed AI investigations and agent access**
  Spec ref: Graph adapter contract; subgraphs/arcmap/README.md.
  What to build: Address CLI dependency risks, deploy the Arc subgraph, verify indexing,
  expand contract coverage, connect a dedicated transfer adapter, then enable agent-selected
  tools and MCP access. Explorer and Graph provenance remain explicit.
  Acceptance: A real agent uses live Graph results to answer a useful project question.
  Removing Graph breaks this workflow; no raw-query-only demonstration or relabeled explorer data.
  Verify: Independently compare fixed-block results, report indexing lag, run an actual agent
  against the tools, and test unavailable/indexing-error responses.
  Note: Graph work can advance during Release A; it must not gate all tracker progress.

- [ ] **9. Shared research and funded hunts**
  Spec ref: Launch-first user experience; docs/SPONSORS.md.
  What to build: Shared watchlists and research notes; Privy wallet onboarding; Circle/Arc USDC
  payments for genuinely useful investigation services; capped budgets, cancellation, settlement
  and unused-budget handling. Choose a real paid service before creating artificial payment steps.
  Acceptance: A user can understand and approve spending, receive a useful result, and inspect
  the transaction and spending record. Server-enforced controls reject over-budget requests.
  Verify: One authorized testnet financial flow, rejected over-budget/duplicate settlement cases,
  and clear failure/cancellation handling. Never infer transaction authority from stored keys.

- [ ] **10. Submission evidence and ongoing launch loop**
  Spec ref: docs/SPONSORS.md; subgraphs/arcmap/README.md.
  What to build: Maintain the architecture diagram, reproducible setup, integration evidence,
  public-source readiness and required submission materials. Gather real feedback from the first
  users and improve discovery coverage and follow relevance.
  Acceptance: Each sponsor claim points to working code and demonstrated behavior; originality,
  partner selections and submission obligations are checked against the event's actual rules.
  Verify: Cold setup from the submitted revision, evidence links, and actual submission state.
  Boundary: User controls recording, public release of source, submission and outbound messages.

## Public launch boundary

### Completed local slice — 2026-09-04

Implemented a first version of catalog, persistence, Today, project following and read-only
agent HTTP access. All three configured live sources succeeded in the first ingestion run.
Eleven tests cover counter integrity, baseline/delta distinction, deduplication, out-of-order
observations, outages, recovery, persistence and ingestion leases. Typecheck and build passed.
API route/status smoke checks passed. Actual visual/browser interaction review remains open.
The ten release checklist items above remain unchecked because their full acceptance criteria
include broader coverage, production operation and visual verification beyond this slice.

No hosting platform or paid infrastructure is selected by this plan. Provider selection must
support a durable database and scheduled ingestion, not just a frontend preview. A deployment
credential stored locally is not a configured hosting account. Wallet and provider secrets stay
outside git; read-only launch does not need access to the wallet private credential.

## Evidence rules

A finding must carry a claim, source, retrieval time, event/block time, sample coverage and
limitations. “No events returned” is not “nothing happened”. Same sender is not same beneficial
owner. Equal holders and transfer counts are an observation, not proof of wash trading.
