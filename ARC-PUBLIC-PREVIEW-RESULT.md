# ARC public preview result — 7 September 2026

Status: repaired and locally verified on `cursor/arc-policy-envelope-0913-118b`.
Draft PR: [#11](https://github.com/Morkeeth/arc-map/pull/11), based on the A1 branch.

- Production webpack is green. Client-visible proposal IDs use pure JavaScript; `node:crypto`
  remains off the Action Proposal client path.
- The current AGENTS shared-state section is restored without removing existing product rules.
- A supported Hunt can save an editable policy envelope and simulated/withheld receipt to its
  private cookie workspace. The exact receipt and retained evidence reappeared after a production
  process restart at desktop and 390 px.
- The negative control withheld at `counterevidence`; no action object or execution was produced.
- Draft PR #9 stays separate because contributor grants and revoke are a distinct authority
  journey. Its persistent contribution is still required, but re-share eviction and post-commit
  rollback must be fixed before integration. The next slice is specified in the cloud receipt.
- No signing, approval, transfer, swap, bridge, deployment or live-fund action occurred.

Checks: 82 tests passed; webpack build, sequential typecheck and hosting-readiness check passed.

Full evidence and limitations:
`docs/CLOUD-RECEIPT-arc-public-preview-2026-09-07.md`.
