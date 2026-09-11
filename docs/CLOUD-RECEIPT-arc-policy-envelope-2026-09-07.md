# Cloud receipt — ARC MAP policy envelope → simulated action

Date: 7 September 2026

## Revision and scope

- Starting SHA: `f1f9d9344d505d7ec3412c65582aca40838d4017`
- Starting ref: `cursor/arc-discovery-hunter-2026-09-07-196a`
- Feature branch: `cursor/arc-policy-envelope-0913-118b`
- Draft PR: requested against the starting ref; repository write approval was still pending when
  this receipt was recorded, so GitHub had not assigned a PR URL.
- Live execution: not implemented or attempted.
- Repair allowance used: none.

The feature branch name is the branch assigned to this cloud environment. It was verified at the
exact requested starting SHA before the first change. PR #9 and PR #10 histories were not changed.

## Product receipt

A Hunter report with stance `limited-support` now exposes one editable policy envelope on the
existing Action Proposal surface:

| Policy field | Bound |
| --- | --- |
| Amount ceiling | Positive amount, maximum 10; candidate amount must not exceed it |
| Approved asset | `Arc testnet native USDC (simulation only)` |
| Approved target | Exact contract bound to the Hunter report |
| Evidence threshold | Minimum distinct transactions from the retained report |
| Expiry | Defaults to 24 hours after report observation; must not be past |
| Counterevidence | Non-empty reference, seeded from the report's first limitation |

Submitting the form evaluates a review-only allocation and returns an inspectable receipt.
A passing envelope returns `simulated` and says that no execution occurred. A failed envelope
returns `withheld`, no action, and a stop reason naming the failed field. Unsupported or
insufficient reports return a withheld receipt at `evidenceThreshold` before an envelope is
attached.

## Truth review

- The empty-counterevidence test fires the red guard: status `withheld`, action `null`, stop field
  `counterevidence`.
- The missing-evidence test stops at `evidenceThreshold`.
- The UI does not call a wallet, signer, chain client, payment API or broadcast route.
- “Arc testnet native USDC” is an approved simulation label, not proof of a balance or transfer.
- The evidence threshold counts distinct transactions in the bounded Hunter sample. It is not a
  complete history, user count, ownership claim, motive claim or investment signal.
- Counterevidence is a required reference for review; this slice does not independently verify the
  text a user enters.
- At this initial revision, the editable envelope and generated product receipt were browser-local
  review state. The later public-preview repair on the same branch supersedes that limitation by
  storing the latest review in the private cookie workspace; see
  `docs/CLOUD-RECEIPT-arc-public-preview-2026-09-07.md`.
- No live, testnet or local-chain transaction was signed, approved, transferred, swapped, bridged
  or deployed.

## Verification

| Command / check | Result |
| --- | --- |
| `git diff --check` | Passed before the implementation commit |
| `npm test` | Passed: 81 tests, 0 failures |
| `npm run typecheck` | Passed |
| `npm run build` | Passed with Next.js 16.3.4 |
| Desktop acceptance | 1280 × 973 CSS px; passing receipt and red counterevidence stop exercised; no horizontal overflow |
| Phone acceptance | 390 × 924 CSS px; fields and receipt stacked; no page overflow or clipping |

The browser used a live explorer Activity Hunter result with 50 sampled successful incoming
transactions and stance `limited-support`. The default envelope produced a simulated receipt;
clearing counterevidence produced a red withheld receipt naming that field. No readily available
live target returned an unsupported stance during manual acceptance, so that state is covered by
the deterministic unit test rather than claimed as a browser observation. Development-console
output contained framework and embedded-wallet configuration notices, but no runtime error.
