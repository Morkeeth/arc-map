# Cloud receipt — ARC MAP public-preview policy repair

Date: 7 September 2026

## Revision

- Repair starting SHA: `7c5a55fc931c4e2e6911e766f2ef30ffa097dc8e`
- Feature branch: `cursor/arc-policy-envelope-0913-118b`
- Base: `f1f9d9344d505d7ec3412c65582aca40838d4017` on
  `cursor/arc-discovery-hunter-2026-09-07-196a`
- Draft PR: creation requested against the base branch. Repository settings still required
  interactive approval and had not assigned a URL when this receipt was written.
- Repair allowance: one harness repair used. The first restart-proof invocation stopped before an
  API call because this repository emits CommonJS through `tsx`; dispatch was moved from top-level
  `await` into `main()`, committed, and the full proof then passed.

No deployment, publication, wallet approval, signing, transfer, swap, bridge or live-fund action
was performed.

## Webpack and client boundary

`ActionProposalPanel` imports `action-proposal.ts` into the client graph. The prior top-level
`node:crypto` import was therefore invalid for webpack even though typecheck and the default
Turbopack build passed. Proposal and receipt display IDs now use `stableId`, a deterministic
pure-JavaScript FNV-based label with no authentication or commitment role. Cryptographic mission,
workspace and report commitments remain on Node-only server paths.

`npm run build` now runs `next build --webpack`, so the required production bundler cannot be
silently replaced by the default Turbopack path.

## Shared-state header

The current shared-state section was restored at the top of `AGENTS.md` while retaining all
existing product, evidence, Hunter and Next.js rules.

Git inspection found that fetched `main` at `490696286b5ca08844940e5f957e4133fc3462c7`
does not contain a distinct shared-state section, and the requested A1 tip commit does not modify
`AGENTS.md`. There was therefore no exact header on current GitHub `main` to copy byte-for-byte.
The restored section records the fetched authority, A1 base, policy repair branch, separate PR #9
ownership and the required pre-slice ref/owner check.

## Persistent public-preview journey

The latest policy review is now stored inside the owner-scoped mission record in
`.data/missions.sqlite`. The mutation route applies the existing same-origin or agent-token access
check, evaluates the envelope again on the server, and stores both passing and withheld receipts.
Another cookie workspace cannot read or update the mission.

Exact local production proof:

1. Loaded a retained activity discovery lead with a visible Why NOW explanation, public source
   evidence and explicit counterevidence.
2. Created an explorer Activity Hunt for the same project and contract
   `0x49f9636fe15883e16d5e356a4ea08c9fe6bc219b`.
3. Retained a `limited-support` report with eight evidence links and five limitations.
4. Submitted an empty counterevidence reference. The server stored `withheld`, no action, and stop
   field `counterevidence`.
5. Restored the lead counterevidence plus the report limitation and submitted `0.01` under a
   `0.05` ceiling. The server stored simulated receipt `sim-999db050` and no execution.
6. Stopped and restarted the production process.
7. Reused the same opaque cookie workspace and retrieved the same lead, mission, report,
   counterevidence, envelope and receipt ID without resubmitting.

The exact machine-readable commands were:

```sh
node --import tsx scripts/test-policy-revisit.ts prepare
# stop and restart the local production process
node --import tsx scripts/test-policy-revisit.ts revisit
```

The cookie value is random, stored only in ignored `.data/` for the two proof phases, and is not
printed or committed.

## Cold interface acceptance

After the process restart, an isolated Chrome session received the same proof cookie and cold-loaded
the retained mission.

| Viewport | Measured document | Result |
| --- | --- | --- |
| Desktop, 1280 × 900 | client width 1265; scroll width 1265 (15 px vertical scrollbar) | Receipt, evidence, counterevidence and “No execution occurred” visible; no horizontal overflow |
| Phone, 390 × 844 | client width 390; scroll width 390 | Single-column envelope and receipt visible; no clipping or horizontal overflow |

Both cold views displayed `sim-999db050`, status `simulated`, retained source transactions,
counterevidence and the explicit no-execution statement. The isolated browser detected no
application-error screen. Screenshots were verification artifacts in ignored `.data/`, not
published assets.

## PR #9 decision

Decision: keep draft [PR #9](https://github.com/Morkeeth/arc-map/pull/9) separate from this repair.

User-journey reason: this slice closes one owner’s retained discovery → Hunt → policy → receipt →
return loop. PR #9 adds a different authority transition: a one-use contributor grant,
append-only sourced contribution and revoke. Pulling that branch directly into this repair would
also remove the A1 Why NOW/action work because it diverged before A1, and its two open state defects
could make a public review less trustworthy.

This decision does not treat collaborative counterevidence or revoke as optional. The current
gap is explicit: policy counterevidence consists of retained lead/report limitations plus an
owner-entered reference; it is not a persisted external contributor submission.

Concrete next slice:

1. Rebase the PR #9 behavior onto the accepted public-preview tip without replacing A1.
2. Replace destructive re-share (`DELETE` then new invite) with an explicit rule: refuse re-share
   while an accepted contributor remains active, or require a separately recorded revoke first.
   Prior contributions must remain owner-visible.
3. Fix invite acceptance so no catch path attempts `ROLLBACK` after `COMMIT`; complete all
   fallible validation before commit or return committed state outside the transaction handler.
4. Add tests that re-share cannot silently evict an accepted contributor and that post-commit
   retrieval failure cannot mask committed access state.
5. Let the owner select a retained contribution as the policy counterevidence reference, then bind
   that immutable contribution ID and source URL into the simulation receipt. Revoke removes
   contributor access, not the owner’s retained contribution history.

No PR #9 code path was modified in this branch.

## Verification

| Check | Result |
| --- | --- |
| `npm test` | 82 passed, 0 failed |
| `npm run build` | Passed with Next.js 16.3.4 webpack |
| `npm run typecheck` | Passed after build completed |
| `npm run check:hosting` | Passed; mechanical readiness only |
| Restart proof | Passed with identical cookie workspace, mission and receipt |
| Negative control | Passed at stop field `counterevidence` |
| `git diff --check` | Passed before commits |

Webpack reports existing warnings from viem’s Tempo dynamic dependency and Privy’s optional
Farcaster Solana module. They did not fail compilation, but this receipt does not relabel them as
resolved. A typecheck launched concurrently with webpack briefly saw webpack replace generated
`.next/types` files and failed with missing-file diagnostics; the valid sequential post-build
typecheck passed.

## Limits

- Policy reviews are private cookie-workspace records, not account-recoverable or cross-device.
- Only the latest policy review is retained on a mission; this is not an append-only approval log.
- Receipt IDs are display labels, not hashes proving correctness or authorization.
- A simulated receipt means policy checks passed for a review artifact. It does not prove balances,
  liquidity, safety, ownership, motive, user identity or executable transaction success.
- The production process was local. No public host, DNS, paid provider or deployment was used.
