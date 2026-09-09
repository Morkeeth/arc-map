# Sponsor decision

Recommendation on 2026-09-04: **Arc + The Graph + Privy**.
This is intended product fit, not a claim of current prize eligibility.

## The Graph

The current prize page has separate From Scratch and Continuity pools for Best AI Tooling or AI
Use Case. Both require The Graph to be load-bearing, live provider data and meaningful work rather
than a raw query. The Continuity pool additionally requires selecting that pool and documenting
pre-existing work. The composable/standardized track requires composition of two Graph products
or meaningful use/contribution of a standardized schema; one custom subgraph query is insufficient.

Current state: a deployed SUN-only Arc testnet subgraph exposes immutable `Transfer` entities. The
Graph-backed Hunter queries it live when `GRAPH_TRANSFERS_URL` is configured. The retained thesis
condition uses event block/log identity, while retrieval time and indexed-block progress alone do
not resolve the condition. Explorer fallback is explicitly labeled and does not satisfy Graph
requirements. C4 extends pre-existing code from the base recorded in `hack.md`; Continuity is the
candidate pool, not certified eligibility.

Source: https://ethglobal.com/events/ethonline2026/prizes

## Arc

The current prize page asks for meaningful Arc/USDC use and a functional frontend/backend plus
architecture diagram and demo. Agentic tracks additionally look for agents that transact with
clear decision logic and USDC flows. A research map or a past standalone transaction is not that
complete current flow.

Current state: the product reads Arc testnet Graph and explorer evidence, preserves chain ID
5042002, and has a testnet-only fixed-fee escrow and policy preparation path. This C4 run does not
sign, broadcast, deploy or claim mainnet readiness. The end-to-end current browser financial flow
remains a separate acceptance requirement.

Source: https://ethglobal.com/events/ethonline2026/prizes

## Privy

Best financial flow: $2,500. Embedded wallet onboarding and a real mission funding/spend flow.
Required: use at least one Privy wallet and complete a functional financial flow with a generally
available feature. A login button is insufficient. The B2B track is not the default target simply
because two coworkers use the app.

Current state: Privy is integrated for authentication and linked embedded/external wallet
selection. The product can prepare exact policy-bound terms, but this C4 run has no authenticated
wallet or completed functional financial-flow receipt. Unit tests, a login dialog or a past
standalone testnet transaction do not satisfy the prize requirement.

Source: https://ethglobal.com/events/ethonline2026/prizes

## Event constraints

Maximum three partners, multiple tracks from a partner count once. Submission Sep13 noon EDT.
Partner judging is asynchronous; finalist judging requires a live presentation with timing in
the dashboard. Start Fresh excludes project-specific work before official start, including
designs/assets. Exact eligibility has not been certified. Record origins and AI contributions.

Source: https://ethglobal.com/events/ethonline2026/info/details

Do not sum first prizes into an expected return or assume several tracks can all be won.
If funded hunts are removed from the product, revisit Privy/Arc fit instead of adding a decorative
wallet action. Bazantic is the alternative to research for a genuinely reusable investigation
service with its required recipe and gateway integration, not a fourth prize selection.

