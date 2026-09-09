# Hosting readiness — local / reviewable plan (no spend)

This document is the concrete runnable configuration and review checklist for ARC MAP.
It does **not** authorize production deployment, paid cloud accounts, wallet funding or
public launch. Oscar / root retain those decisions.

## What “ready” means here

| Layer | Ready when | Not ready if |
|-------|------------|--------------|
| Local product loop | `npm ci` → `npm run build` → `npm run start` + `npm run workers` on Node 22; Today → Hunt → return works against SQLite under `.data/` | Only `next dev` was tried; workers never ran |
| Config | `.env.local` copied from `.env.example`; `NEXT_PUBLIC_APP_ORIGIN` matches the browser origin | Secrets in `NEXT_PUBLIC_*`; executor private key committed |
| Optional Graph | `GRAPH_TRANSFERS_URL` set only if you intend Graph hunts; explorer path works without it | Missing Graph is relabeled as explorer success |
| Optional escrow | Addresses + code hash set only after an **explicit** testnet deploy authorization | Defaulting to “configured” because env keys exist empty |
| Container sketch | `Dockerfile` multi-stage `web` + collector targets build with Node 22 | Treating the Dockerfile as a live hosted service |

## Zero-spend local path (authorized)

This is the **exact free / no-new-spend hosting option** for judges and operators:
run the product on a local machine (or a machine you already control) with Node 22,
SQLite under `.data/`, and optional `compose.yaml`/`Dockerfile` sketches. Limitations:
no public judge URL until Root deploys; cookie workspace is device-local; Graph remains
SUN-only unless a verified index is configured; workers must run separately for live
radar/thesis freshness.

```sh
# Node 22.x required
node -v
npm ci
cp -n .env.example .env.local
# Edit NEXT_PUBLIC_APP_ORIGIN if not http://localhost:3107
npm run typecheck
npm run test
npm run build
npm run start          # http://localhost:3107 (or PORT)
# separate terminal — supervised collectors
npm run workers
```

Cold journey to verify before calling the build hosting-ready:

1. Open Today → reopen last investigation if present (`/hunters?id=…`).
2. Run one explorer Hunt on SUN; leave; return via Today “Your last investigation”.
3. Follow a project; wait for ingest cycle; open Changes.
4. Confirm worker pulse does not invent “all live” when workers are stopped.

```sh
npm run check:hosting
npm run check:integrations   # may report optional Graph/escrow as not configured — that is OK
```

## Reviewable deploy plan (not executed)

When Oscar authorizes a host (still no spend from this doc):

1. **Build artifact:** `Dockerfile` target `web` (standalone Next) + separate collector process(es) from `npm run workers` or per-script watches. Persist `.data/` on a volume; do not bake SQLite into the image.
2. **Origin:** set `NEXT_PUBLIC_APP_ORIGIN` to the exact HTTPS origin before `npm run build` (baked into client). CSRF/cookie checks use this value.
3. **Secrets:** inject `ARCMAP_AGENT_TOKEN`, Graph, escrow keys at runtime only; never into git or client bundles.
4. **Health:** `GET /api/workers` and `GET /api/integrations` for operators; do not treat process-up as evidence freshness.
5. **Stop conditions:** no public DNS cutover, no paid API upgrade, no mainnet escrow from this checklist.

## Explicit non-goals

- No Vercel/Fly/AWS spend from Cursor/root agents under current authorization.
- No “needs Oscar” as a substitute for writing the config — Oscar decides only spend/DNS/publish.
- Hosting readiness ≠ ETHOnline submission package.

## Related

- `.env.example` — variable inventory
- `Dockerfile` — container sketch
- `scripts/check-hosting-readiness.ts` — mechanical gate for this checklist
- Returning Hunt stack: PRs #3–#6 (supervisor → follow-return → Hunt return → Today card)
