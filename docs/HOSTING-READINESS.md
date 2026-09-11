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
| Single-service container | `Dockerfile` target `all` builds with Node 22; web and supervisor restart together; `/app/.data` survives replacement | Treating local container checks as hosted acceptance |

## Zero-spend local path (authorized)

This is the **exact free / no-new-spend hosting option** for judges and operators:
run the product on a local machine (or a machine you already control) with Node 22,
SQLite under `.data/`, or the tested single-service Dockerfile target `all`. Limitations:
no public judge URL until Root deploys; cookie workspace is device-local; Graph remains
SUN-only unless another index is verified. With the Node commands below, run workers in a
separate terminal. The `all` container target starts both web and the worker supervisor.

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

1. **Build artifact:** `Dockerfile` target `all` (the final stage), one service and one writable volume at `/app/.data`. It runs standalone Next.js and the worker supervisor. Do not bake SQLite into the image. Use the checked-in `railway.toml` for health checks and restart-on-failure; do not assume it creates the required volume.
2. **Origin:** set `NEXT_PUBLIC_APP_ORIGIN` to the exact HTTPS origin before `npm run build` (baked into client). CSRF/cookie checks use this value.
3. **Secrets:** inject `ARCMAP_AGENT_TOKEN` and Graph query credentials at runtime only. Escrow addresses and expected code hash are configuration, not signing authority. Never provide a user wallet key or `HUNTER_EXECUTOR_PRIVATE_KEY` to this research host.
4. **Health:** `GET /api/workers` and `GET /api/integrations` for operators; do not treat process-up as evidence freshness.
5. **Stop conditions:** no public DNS cutover, no paid API upgrade, no mainnet escrow from this checklist.

## Container acceptance recorded on 11 September 2026

The image built from commit `3cf2e5d` passed local health, supervisor-failure restart,
web-failure restart, clean stop, and replacement with the same named volume. The image was
built immediately before the commit; its Dockerfile bytes match that commit. This is local
container evidence. After deployment, repeat the saved-record return journey over HTTPS,
check secure cookies and origin handling, and verify retention on the actual host.

## Explicit non-goals

- No Vercel/Fly/AWS spend from Cursor/root agents under current authorization.
- No “needs Oscar” as a substitute for writing the config — Oscar decides only spend/DNS/publish.
- Hosting readiness ≠ ETHOnline submission package.

## Related

- `.env.example` — variable inventory
- `Dockerfile` and `railway.toml` — single-service build and restart configuration
- `scripts/check-hosting-readiness.ts` — mechanical gate for this checklist
- Returning Hunt stack: PRs #3–#6 (supervisor → follow-return → Hunt return → Today card)
