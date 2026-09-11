# AR1 browser opportunity rehearsal — cloud receipt

Date: 2026-09-08  
Starting ref: `day/2026-09-08-ar1-browser-opportunity`  
Starting SHA: `e92eb7d5fc9ca0374e5c5cd72e230f9c92686b40`

## Browser path

The Hunters report now includes an account-bound opportunity rehearsal outside
public research-preview mode. Privy exposes every connected wallet and labels
the selection as embedded or external. The selected address is bound with the
Hunter report, exact target, deterministic fixture asset, 25,000-unit amount,
30,000-unit ceiling, ten-minute expiry and exact ERC-20 calldata.

A fresh live Arcscan Activity Hunter report for
`0x0077777d7eba4688bdef3e311b846f25870a19b9` returned 50 sampled incoming
transactions at `2026-09-08T06:30:29.475Z`. The browser-facing route pinned
source block `61033818`, started an isolated Anvil process, and retained receipt
`opp-dc53ab91` in the private mission workspace. The decoded fixture effects
shown after reopening were:

- selected fixture sender: `1,000,000 → 975,000` (`-25,000`)
- report-bound target: `0 → 25,000` (`+25,000`)

The receipt showed chain ID `31337`, fixture block/hash, source and block,
evidence age/maximum age, exact policy expiry, calldata and binding hash.
`broadcast` was `false`.

The reopened result was inspected in headless Chrome at 1440 CSS pixels and 390
CSS pixels. Document width did not exceed either viewport. At 390 pixels the
binding facts and retained decoded effects stack into one readable column.

The local helper alone is **not acceptance**. This check exercised the
browser-rendered mission panel, private HTTP route, persisted mission receipt,
reopen path, responsive layout and browser-triggered refusal controls.

## Negative controls

All three controls were clicked in the reopened browser panel. Each rendered a
visible refusal and reported `Simulation RPC started: no`:

| Control | Visible reason |
| --- | --- |
| Wrong account | Selected account does not match the policy account binding. |
| Stale evidence | Opportunity evidence is stale; rerun the Hunter within 15 minutes. |
| Changed calldata | Prepared opportunity binding was changed before simulation. |

Public preview mode omits Privy and the server route returns `403`; it remains
wallet-free and simulation-only.

## Verification

- `npm test`: 90 passed
- `npm run test:opportunity-action`: 5 passed; positive local Anvil receipt passed
- `npm run typecheck`: passed
- `npm run build`: passed
- `git diff --check`: passed

The production build retained pre-existing warnings for the optional Privy
Farcaster Solana package and a dynamic viem Tempo dependency.

## Limitations

- Chain ID 31337 is an isolated local fixture. This is not Arc public-chain,
  Arc testnet or mainnet proof.
- The connected wallet contributes an address only. The rehearsal deliberately
  requests no signature and does not prove wallet ownership.
- No live Privy login was performed in the cloud browser. The no-wallet state,
  retained receipt, desktop/phone layouts and all refusal interactions were
  inspected; selecting an authenticated embedded/external wallet remains a
  user-side acceptance step.
- `debug_traceCall` effects are simulated and are not persisted on any chain.
- The Arcscan report is a bounded 50-transaction sample, not complete history
  or evidence of unique users, target safety, motive or eligibility.
- No live funds, signing, broadcast, deployment, publication or new spend
  occurred.
