# ARC acceptance · 2026-09-10 · Cursor integrate

Local only. No spend, wallet, deploy or visibility flip.

## Graph
- Endpoint: existing `GRAPH_TRANSFERS_URL` (Studio arcmap/v0.1.0)
- Live `_meta.block` observed; SUN Transfer sample returned; `hasIndexingErrors: false`
- `npm run test:graph-revisit` → status completed; criterion unmet because newest Transfer unchanged (honest)
- Indexed block ~61383xxx; baseline event `0x46f7d2ce…:508` at event block 49206541

## HTTP user loop
- Live ingest + radar seeded research brief (118 cards)
- `npm run test:graph-http` → brief → Graph thesis → check → restart round
- Thesis IDs recorded in `.data-accept/graph-http.json` (local, not committed)
- `npx tsx scripts/test-daily-flow.ts` → counter path restart proofs

## Browser
- `http://127.0.0.1:3107/` HTML captured to `page-home.html` (local cookie workspace)
- Not a public URL. No screenshots claimed beyond HTML capture.

## Tests
- `tsx --test tests/*.test.ts` → 106 pass
- `npm run typecheck` → clean
