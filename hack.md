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

- [x] Slice 1 — prove the risky boundary end to end: implement a standalone opportunity-action
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
- 2026-09-07T19:47Z — Watched the control go red with
  `npm run rehearse:opportunity -- --wrong-account`: exit 1 for selected-account mismatch,
  with `simulationRpcStarted: false`.
- 2026-09-07T19:47Z — First combined full check got all 89 tests green, then failed typecheck
  because viem's public schema does not type Anvil's custom `eth_accounts` and
  `debug_traceCall` methods. Narrowed those two local RPC boundaries and retained the failure
  in the cloud receipt.
- 2026-09-07T19:49Z — Re-ran the red control after adding the baseline arm. The naive ABI
  encoder accepted the unauthorized input; the policy-bound arm exited 1 before simulation.
- 2026-09-07T19:50Z — Checked Slice 1 only after RUNNING the exact done-when command:
  `npm run test:opportunity-action && npm test && npm run typecheck && npm run build && git diff --check`.
  It exited 0: 4 focused tests passed, the local EVM receipt decoded balanced asset deltas,
  89 full tests passed, typecheck passed, the production build completed, and diff-check passed.
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

# Judge-first stage review

This compact review is the public product record. Operational prompts, credentials, personal
notes and private workspace records do not belong here. ARC MAP does not claim uniqueness for
maps, saved cases, AI labels or history: Bubblemaps V2 already offers real-time clusters and
history, while Intel Desk supports collaborative investigations and incentives. The candidate
wedge is a retained research thesis with explicit invalidation evidence and an honest second visit.

| Stage | Criterion | Observed user action | Source/runtime receipt | Largest product gap | Next implementation |
| --- | --- | --- | --- | --- | --- |
| Entry / idea | One product joins Arc discovery, evidence narratives and bounded investigations. | Selected ARC MAP and the Explore → Hunt → revisit loop. | `docs/DECISIONS.md`; repository history beginning 4 Sep 2026. | No proof that a stranger returns. | Build one sourced vertical slice. |
| First vertical slice | A source-linked opportunity reaches a Hunter report without a wallet. | Opened Why NOW, ran a bounded explorer preview and inspected counterevidence. | `src/lib/hunter-runner.ts`; immutable mission report hash. | Explorer-only research is not Graph evidence. | Make one live Graph source load-bearing. |
| The Graph integration | SUN `Transfer` entities determine a conclusion and a later-event invalidation condition. | Selected SUN and attempted the explicit Graph Hunter; the product stopped without substituting Arcscan. | `check:integrations` verified Arc RPC but reported Graph unconfigured; `test:graph-revisit` returned `GRAPH_TRANSFERS_URL` unavailable. | This cloud runtime cannot produce the required live Graph provider receipt; deployed coverage remains SUN-only. | Configure the existing query endpoint in an authorized environment, then replay the same bounded driver. |
| Arc integration | Arc testnet identity, chain guard and USDC research policy remain bounded. | Reviews an exact policy or withheld reason; no opportunity transaction is required for research. | Chain ID 5042002, `HunterEscrow.sol`, local lifecycle and prior dated testnet receipt in `docs/VERIFICATION.md`. | Current browser funding lifecycle is not fully accepted. | Separate authorized wallet acceptance; do not infer mainnet readiness. |
| Privy integration | Actual linked wallets are labeled embedded or external before preparation. | Can connect and select a linked account, then review exact unsigned terms. | `wallet-provider.tsx` and the prepared policy view; no authenticated wallet receipt in this C4 run yet. | Prize rules require at least one Privy wallet and a completed functional financial flow. | Perform a separately authorized real-wallet acceptance without weakening policy checks. |
| Retained thesis / revisit | A locked condition distinguishes a later event from index or retrieval progress. | Can start from a completed Graph mission, save its newest event identity, run a finite same-provider check and return to the evidence trail. | Unit fixtures cover later event, index-only unchanged and provider failure; `test:graph-revisit` is the live replay path. | No live Graph mission could be created in this runtime, so no live thesis receipt is claimed. | Run the driver and browser loop where `GRAPH_TRANSFERS_URL` is already authorized. |
| Pre-demo | A stranger can state user, pain and signature interaction from the product alone at 1440 and 390 CSS px. | Saw SUN, selected The Graph, read the endpoint boundary, attempted research and received a visible blocked result; separately inspected the Graph thesis rule. | Sanitized 1440 and 390 screenshots are attached to the C4 review, not tracked as provider evidence. | The visual proof is a capability failure, not a successful partner demo. | Repeat the identical path with live Graph configuration and retain the successful thesis check. |
| Exact submitted build | Submission SHA, public repository and 2–4 minute video are fixed and reproducible. | Not submitted. | **No submitted build or video receipt yet.** | Submission and public-repo requirements remain open. | Record the exact reviewed SHA only when submission is authorized. |
| Pre-results retro | Product and integration misses are written before judging results. | Not started. | **Pending; no result inferred.** | Risk of retrofitting the story after results. | Record before results when the submission exists. |
| Results append | Actual judging and partner outcomes are appended without rewriting the retro. | No results. | **Pending.** | None can be inferred before judging. | Append exact outcomes and source after they exist. |

## Provider removal test

Removing The Graph removes the schema-bound SUN event baseline, indexed-block provenance and the
finite “later `Transfer` entity” revisit condition. Explorer discovery and previews would remain,
but this partner-backed thesis loop would not. A raw query, badge or renamed explorer response does
not satisfy that criterion.

## Continuity disclosure

C4 extends existing ARC MAP code from exact base
`a2b5492bb89bd59676e80355ace4d7d71a995d5b`; it is not a from-scratch claim for this branch.
The official event page describes a Continuity pool for The Graph AI work and requires disclosure
of pre-existing work, live provider data, meaningful use, public source and a 2–4 minute video.
This repository record supports disclosure but does not certify event or partner eligibility.
