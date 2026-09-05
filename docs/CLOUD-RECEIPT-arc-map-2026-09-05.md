# Cloud receipt — Arc Map — 2026-09-05

Agent overnight run against `hack.md`. Private branch only; no public publish.

## SHIPPED

1. **`hack.md`** — overnight contract (was missing; written before code).
2. **Ship Hunter saved-release investigations**
   - `src/lib/providers/releases.ts` — GitHub Releases parse/fetch
   - `src/lib/ship-claim.ts` — evidence arm vs naive latest-tag baseline
   - `src/lib/ship-store.ts` — owner-scoped SQLite; immutable claim + pinned observation; append-only reruns
   - APIs: `/api/repository/[id]/releases`, `/api/ship-investigations`, `…/observe`
   - MCP tools: `inspect_releases`, `create_ship_investigation`, `list_ship_investigations`, `get_ship_investigation`, `observe_ship_investigation`
   - UI: Ship Hunter panel takes a claim, investigates releases, shows both arms, re-observes
   - Offline fixtures + `scripts/ship-hunter-eval.ts` + `scripts/test-ship-hunter-http.ts`
3. **Hosted beta path (no invented host)**
   - `docs/HOSTED-BETA-CHECKLIST.md`
   - `scripts/probe-hosted-beta.ts` — standalone smoke + secret scan + BLOCKED list
4. **Account recovery gap**
   - `docs/ACCOUNT-RECOVERY.md`
   - `scripts/probe-workspace-recovery.ts` — first failing cross-device probe
5. **Privy browser payment probe**
   - `scripts/probe-privy-browser-payment.ts` — stops at first concrete BLOCKED step
6. Hunter catalog entry **H03 Ship Hunter**; backup includes `ship-investigations.sqlite`

## VERIFIED

| Claim | Command | Result |
|---|---|---|
| Unit/integration tests | `npm test` | 52 pass (10 ship-hunter, including outage RED + live v0.6.0 object) |
| Offline eval both arms | `npx tsx scripts/ship-hunter-eval.ts --offline` | 6/6 evidenceHits; **2 naive overclaims** (synthetic tag-only + real `v0.6.0` zero-asset object) |
| Live GitHub object | `npx tsx scripts/ship-hunter-eval.ts --live` | arc-node 5 published / 4 with binaries; agent-stack **0** releases → insufficient-evidence |
| Live tag≠package | same live run, claim `v0.6.0` binaries | evidence **not-supported** (0 assets on real `v0.6.0`) |
| HTTP create/list/rerun/isolation | `npx tsx scripts/test-ship-hunter-http.ts` | ok; pinned hash immutable; cross-owner 404 |
| Typecheck | `npm run typecheck` | pass |
| Production build | `npm run build` | pass; ship routes present |
| Standalone host smoke | `npx tsx scripts/probe-hosted-beta.ts` | `/` `/hunters` `/agents` `/api/*` → 200; docker **BLOCKED** |
| Cookie ≠ cross-device | `npx tsx scripts/probe-workspace-recovery.ts` | same 200 / other 404 / cleared 404 / `/api/account/recover` 404 |
| Privy browser payment | `npx tsx scripts/probe-privy-browser-payment.ts` | **BLOCKED** at `2.escrow-env` (then would block on interactive Privy login). Exit 2 |
| Integrations without secrets | `npm run check:integrations` | RPC verified; graph/escrow **not configured**; fundingPrerequisitesMet false |
| MCP advertises Ship tools | `POST /api/mcp` tools/list with Origin | **24** tools including `inspect_releases`, `create_ship_investigation`, `observe_ship_investigation` |
| Desktop + 390px Ship Hunter UI | browser session on `localhost:3107` | LIMITED SUPPORT for v0.8.0 claim; release list includes live `v0.6.0 · no binaries`; no horizontal overflow at ~390px. Screenshots: `/opt/cursor/artifacts/screenshots/ship-hunter-desktop.png`, `ship-hunter-phone.png` |

## WRONG

1. **First HTTP test was a false failure I caused:** used `Origin: http://127.0.0.1:3107` while `missionAccess` allows `http://localhost:3107`. The control correctly returned 400. Fixed the script; do not treat 127.0.0.1 and localhost as interchangeable here.
2. **Privy browser payment was not completed.** First hard stop in this environment is missing `HUNTER_ESCROW_*` env; even with escrow, interactive Privy login/signature is still BLOCKED without Oscar's click. CLI lifecycle was **not** re-run and is **not** claimed as browser verification.
3. **No public host was stood up.** Docker daemon absent; no hosting account/domain/spend. Checklist is honest BLOCKED, not a URL.
4. **Account recovery was not implemented** — only the failing probe + design choices. Guessing a Privy server auth design would violate open questions.
5. **Ship investigations do not yet attach to theses** (explicitly left open).
6. **Naive arm over-claims on real objects when they are latest:** offline fixture of live `v0.6.0` (0 assets) → naive limited-support, evidence not-supported. When `v0.6.0` is not latest in a full live list, naive can miss for a different reason (latest-tag only).
7. **`next start` warns** that standalone output should use `node .next/standalone/server.js`; smoke used the standalone entry. `npm run start` still works enough for local HTTP tests but is not the Docker/web image path.
8. **Graph coverage was not invented** and remains unconfigured in this cloud agent (`GRAPH_TRANSFERS_URL` absent).
9. Subagent summary briefly mislabeled the fifth release row as `v0.8.0 · no binaries`; the on-screen object and screenshot show **`v0.6.0 · no binaries`** (re-checked against the artifact).
