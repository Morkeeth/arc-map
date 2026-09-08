# AR1 Privy funding receipt — 2026-09-08

## Delivered

- The browser prepares one exact Arc testnet funding policy before opening Privy.
- The policy binds the linked account, escrow target, native testnet-USDC amount and ceiling, mission and thesis, Graph evidence block and timestamp, report hash, executor, service, fee, deadline, calldata, and a 60-second expiry.
- The normal browser path contains no private key. The executor remains a separate configured address.
- Privy may fund only from a connected wallet that is also present in the authenticated user's linked accounts.
- The browser refuses the wrong chain and offers an explicit Arc testnet switch.
- After wallet broadcast, the server verifies the transaction, successful receipt, exact calldata and value, `MissionOpened` event, account, target, chain, policy expiry, and current escrow state before saving the mission as active.
- The prepared terms and verified receipt survive a workspace restart and are shown again when the mission is reopened.
- Funding is refused when evidence is unsupported, stale, changed, or not Graph-backed.

## Verification

- `npm run typecheck` — passed.
- `npm test` — 95 passed, 0 failed.
- `npm run build` — passed. The build retains existing optional Privy/Farcaster and viem Tempo warnings.
- Real route at `http://127.0.0.1:3187` — the production UI created and ran a Graph mission, returned block `61058914`, and opened the real Privy login dialog.
- The live report stance was `not-supported`. The funding guard correctly withheld preparation. No transaction was signed or sent.
- Rebuilt production route at 390 × 844 — Privy initialized, Graph and escrow configuration rendered live, and the page had no horizontal overflow (`scrollWidth = innerWidth = 390`). The viewport was restored after the check.

## Remaining live proof

The complete signed browser receipt needs a new, fresh Graph mission whose evidence stance is `limited-support`, plus a funded Arc testnet wallet linked to the Privy account. The user then reviews the exact policy and approves the wallet signature. The server-side verifier and persistent receipt path are ready for that transaction.

This slice does not add server-side Privy access-token verification because no Privy server secret or verification key is configured. Transaction ownership is still enforced onchain by matching the signed transaction sender and the emitted mission owner to the prepared linked-wallet account.
