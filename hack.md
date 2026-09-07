# NORTH STAR

Let a stranger prove, on a pinned local EVM, that one selected account can simulate one tightly
allowlisted opportunity action and see its exact asset delta without broadcasting a transaction.

# PROMISE LINE

The user gets an evidence-bound receipt for an ERC-20 opportunity simulation, constrained so the
account, target, asset, amount ceiling, expiry, counterevidence and calldata must all match policy
before any RPC simulation occurs.

# OPEN QUESTIONS

- Non-blocking: whether a future reviewed slice should support opportunity actions other than the
  single ERC-20 call selected here.
- Non-blocking: whether production policy envelopes should be signed; this repair proves local
  binding and fail-closed simulation only.
- Blocking: none for this slice. The requested starting commit and designated repair branch match.

# CONSTITUTION

- This path is not mission escrow and may not call or extend `prepareMissionAction`,
  `openMission`, `fund` or `closeMission`.
- Only a pinned local Anvil fixture is permitted. No public RPC send, public deployment or live funds.
- No transaction-broadcast API may appear in the opportunity action module or its proof script.
- The selected account, evidence identifier, counterevidence, asset, approved target, amount ceiling,
  expiry, chain identity and calldata are one validated envelope; mismatch or staleness fails before RPC.
- Receipt values are decoded from the local EVM object being simulated, never copied from this prompt
  or a document.
- A green control must first be observed red against a deliberate violation.
- A checkbox is true only after its stated done-when command has run and passed.
- This remains one small draft PR rooted at `28e0c220ebc0797ec4944ed2f18def3e680dfaf5`;
  it does not merge, deploy, publish a preview or claim public-chain execution.

# PLAN

- [ ] Slice 1 — prove the risky boundary end to end: implement a standalone opportunity-action
  encoder/validator and pinned local-Anvil simulation, decode before/after account asset deltas,
  force a pre-simulation rejection red case, add zero-broadcast guard coverage, document a receipt,
  and make the cold local path usable from one command.
  Done when RUN:
  `npm run test:opportunity-action && npm test && npm run typecheck && npm run build && git diff --check`

# NOW

Slice 1 only: allowlisted ERC-20 opportunity simulation and its fail-closed/zero-broadcast proof.

# LOG

- 2026-09-07T19:42Z — Started at exact required SHA
  `28e0c220ebc0797ec4944ed2f18def3e680dfaf5` on
  `cursor/arc-night-opp-repair-2141-392f`.
- 2026-09-07T19:42Z — `hack.md` did not exist. Created it before changing product code.
- Verification has not run yet; Slice 1 remains unchecked.
# ARC MAP · external wallet / Graph / simulation seam

## NORTH STAR

ARC MAP lets a stranger explore live Arc evidence, understand a sourced story, and commission bounded research without confusing research escrow with opportunity execution.

## PROMISE LINE

A user gets an honest map of what wallet connection, Graph-backed research, and allowlisted mission preparation can do today, constrained so this work never enables a public-preview chain route or broadcasts a transaction.

## OPEN QUESTIONS

- What connector is actually mounted, and which wallet interactions work outside preview mode?
- Which live research fields come from The Graph, which come from an explorer, and how are freshness and provider failures represented?
- Is there an official Arc/network event associated with September 16, or must the receipt record that no exact event was found?
- Which existing mission action is the narrowest useful local rehearsal target?
- Blocking: none before evidence collection. If local rehearsal cannot be made structurally non-broadcasting through the existing seam, implementation stops at an honest receipt rather than adding a new send path.

## CONSTITUTION

- Live source data or an explicit unavailable state; never invent users, activity, funds, findings, events, or deadlines.
- Open and inspect the actual connector, source adapter, chain preparation code, and official event/network source; do not rank or diagnose from titles, names, or nearby proxies.
- Retrieval timestamps are not event timestamps, explorer counts are not active users, and sampled evidence is not complete history.
- Provider failures stay visible and correctly attributed.
- Research escrow pays for fixed-price research; it is not opportunity execution, an investment share, or a Hunter token.
- Preserve testnet-only, expected-report commitment, allowlist, and owner refund controls.
- No live funds, deployment, publishing, broadcast, new spend, repository visibility change, public-preview wallet enablement, PR merge, credentials, private-board data, or `.internal` content.
- A completion claim is true only after its stated done-when command has run. A control is not trusted until its negative path has been observed failing.
- Re-derive claims and figures at their owning objects; do not carry numbers from prompts or prose.

## PLAN

1. **Risk-first source and safety seam:** inspect wallet/provider behavior, Graph/explorer provenance, preview gating, and official sources; add a non-broadcasting local rehearsal through the existing mission-action preparation seam; produce the public-safe receipt.
   - Done when positive and negative rehearsal checks execute, touched-path tests execute, and the receipt identifies provenance, limitations, starting SHA, and searched official URLs.
2. **Cold-clone acceptance:** prove the rehearsal and receipt instructions work with no key and no network from a clean checkout, correcting only defects exposed by execution.
   - Done when the documented cold command runs in an isolated clean checkout with network access disabled and no credential variables.
3. **Interface acceptance if behavior is visible:** inspect desktop and phone widths and document only behavior observed at the actual screen.
   - Done when the app is exercised at desktop and phone widths, or the log records that this slice was inapplicable because no interface changed.

## NOW

**Slice 1 only — risk-first source and safety seam.**

- Establish the requested branch from the exact starting ref and record any divergence.
- Read the actual wallet connector, Privy/viem path, mission-chain implementation, Hunter execution contract, preview flag, source adapters, and current verification guidance.
- Search first-party Arc/network sources for the alleged September 16 event and cite the exact source or record NOT FOUND plus queries and inspected URLs.
- Add the smallest useful local rehearsal at the existing allowlisted preparation seam, structurally unable to broadcast, with a negative check observed red.
- Write `docs/CLOUD-RECEIPT-arc-night-wallet-graph-2026-09-07.md`.
- Run the relevant rehearsal checks plus `npm test`, `npm run typecheck`, and `npm run build`; record exact commands and outcomes before making completion claims.

## LOG

- Prior slice at this starting ref recorded successful candidate pinning, why-now/action-proposal/baseline tests, full application checks, desktop/phone inspection, and a live evaluation. Its detailed receipt remains `docs/CLOUD-RECEIPT-arc-discovery-hunter-2026-09-07.md`; those historical results are not treated as verification of this slice.
- 2026-09-07T19:10Z — Initial stale `main` checkout at `490696286b5ca08844940e5f957e4133fc3462c7` had no `hack.md`, so a provisional current contract was created before implementation. Switching to the requested object revealed the prior tracked contract; it was then read at the actual object with `git show HEAD:hack.md` and this contract was reconciled to retain one current NOW.
- 2026-09-07T19:12Z — Designated branch `cursor/arc-night-wallet-graph-2108-ad60` verified at requested starting ref `c985b0ef7fcce23939c767a147a02b7e47115fd3`.
- 2026-09-07T19:12Z — Open PRs inspected. PRs 10–12 own the discovery/policy/public-acceptance chain; PR 9 remains untouched.
- 2026-09-07T19:14Z — First `npm run rehearse:mission -- --action send` failed for the wrong reason (`tsx: not found`, exit 127). This was not counted as an allowlist result. Ran `npm ci`; 786 locked packages installed and npm reported 10 moderate advisories.
- 2026-09-07T19:15Z — Reran `npm run rehearse:mission -- --action send`; it exited 1 at `Unsupported wallet action.` The allowlist control was observed red.
- 2026-09-07T19:15Z — `npm run rehearse:mission` exited 0 and decoded unsigned `openMission` calldata from deterministic fixtures with no signer, RPC or broadcast path.
- 2026-09-07T19:15Z — `node --import tsx --test tests/mission-action.test.ts` passed 3 tests.
- 2026-09-07T19:15Z — Official-source commands executed with `curl -fsSL … | rg -o … | sort -u`: Circle returned the September 16, 2026 public-mainnet target plus its modification/delay/cancellation warning; Arc returned both current public-testnet and mainnet-coming-soon statements.
- 2026-09-07T19:16Z — `npm test` passed 85 tests; `npm run typecheck` passed; `npm run build` passed with existing viem dynamic-dependency and optional Privy Farcaster/Solana-module warnings.
- 2026-09-07T19:17Z — First direct preview-route probe failed because the TypeScript loader exposed the route through its default export. The corrected `NEXT_PUBLIC_RESEARCH_PREVIEW=1 node --import tsx --input-type=module -e '…'` probe exercised GET and POST; both returned 403 with the explicit preview-unavailable error.
- Slice 1 done-when commands have run. Slice 2 cold-clone acceptance and Slice 3 interface acceptance were not started because NOW authorizes exactly one slice.
