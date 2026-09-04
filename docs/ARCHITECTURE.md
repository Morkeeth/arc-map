# Architecture and next proofs

## Current boundaries

Next.js App Router, React, TypeScript, Lucide. npm lockfile pins resolved dependencies.

```text
Browser atlas / field note / watchlist
    GET /api/discover
        Graph adapter if explicitly configured
        otherwise Arcscan explorer token listings
    GET /api/hunt?address=...
        fixed scout → explorer counters + latest transfer page
        pure analysis → bounded findings with source transactions
```

Follow lists are local browser state. The scout is a fixed evidence check, not an autonomous LLM.
No paid flow, wallet signing, MCP transport, project directory or background job is implemented.

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

## Build sequence

1. **Discovery coverage:** index an explicit Arc contract set through a live Graph provider.
   Check transfer and holder results against independent explorer/RPC witnesses at a fixed block.
   Include a failing fixture for partial history and a stale provider head.
2. **Changes worth following:** persist timestamped snapshots and emit diffs. Zero change,
   source failure and “no baseline yet” must be distinct. Add project entities beyond token names.
3. **Shared fieldwork:** accounts, shared watchlists and source-linked Robinhood inspiration notes.
   An Arc project and a Robinhood reference must retain their own chain and provenance labels.
4. **Agent investigations:** common typed tools for evidence retrieval, claim verification and
   published findings. Build MCP transport over these tools; run a real external agent against it.
   The agent may choose steps; deterministic checks constrain what becomes an observed fact.
5. **Funded hunts:** Privy user wallet → capped USDC mission budget on Arc → authorized execution
   → spend record and unused-budget handling. Prove a real payment and a rejected over-budget
   attempt. No transaction or signing authority is granted by the read-only scout endpoint.
6. **Public operations:** authentication, persistent rate limits, durable jobs, isolated workers,
   monitoring and operational runbook. Test a full unattended source outage and recovery.

## Evidence rules

A finding must carry a claim, source, retrieval time, event/block time, sample coverage and
limitations. “No events returned” is not “nothing happened”. Same sender is not same beneficial
owner. Equal holders and transfer counts are an observation, not proof of wash trading.

