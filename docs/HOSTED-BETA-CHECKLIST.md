# Hosted beta checklist — 2026-09-05

Concrete path to a persistent public beta. Items are PASS only when a command was run,
or BLOCKED with the exact missing Oscar key/account. Compose YAML is not a deployment.

## Can stand without Oscar secrets

| Check | Status | Command / evidence |
|---|---|---|
| Production Next build | PASS | `npm run build` |
| Standalone Node package | PASS | `.next/standalone/server.js` exists |
| Standalone HTTP smoke | PASS | `npx tsx scripts/probe-hosted-beta.ts` → `/`, `/hunters`, `/agents`, `/api/hunters`, `/api/integrations` |
| Tracked-source secret scan | PASS | same probe; no private-key patterns in `src`/`scripts`/`docs`/`fixtures` |
| Local restore path | existing | `npx tsx scripts/test-restore.ts` (requires running app + `.data`); local package only |
| Compose + Dockerfile present | PASS | files exist; bind is `127.0.0.1:3117` only |

## BLOCKED — exact missing pieces

| Check | Missing |
|---|---|
| Docker image build / container lifecycle | `docker` CLI + daemon in this environment |
| Public host + TLS origin | Oscar hosting account, domain, spend authorization |
| Funded Graph / escrow runtime on host | `GRAPH_TRANSFERS_URL`, `HUNTER_ESCROW_*`, `HUNTER_EXECUTOR_*`, `HUNTER_SERVICE_ADDRESS` in host env (not in this cloud agent) |
| Agent token for public MCP | `ARCMAP_AGENT_TOKEN` |
| Privy browser auth on public origin | `NEXT_PUBLIC_APP_ORIGIN=https://…` allowlisted in Privy dashboard + Oscar login |
| Workers with laptop closed | Hosted process supervisor for `ingest:watch`, `radar:watch`, `theses:watch` |

## Minimum Oscar actions to unblock public beta

1. Choose host (Fly/Render/VPS) and set a durable volume for `.data`.
2. Set `NEXT_PUBLIC_APP_ORIGIN` to the HTTPS origin; allowlist it in Privy.
3. Inject Graph + escrow + agent token env from a secret store (never into git).
4. Run `docker compose up` **or** equivalent process units for web + three workers.
5. Run `npm run backup` on a schedule into private storage; practice restore once.
6. Complete one Privy browser fund/settle/refund on testnet (see Privy probe).

## Non-claims

- Local `npm run start` / standalone smoke ≠ public beta.
- CLI Arc testnet lifecycle ≠ browser payment.
- Cookie workspaces ≠ cross-device accounts (see recovery probe).
