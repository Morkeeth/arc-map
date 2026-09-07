# Cloud receipt — allowlisted opportunity action on local EVM

Date: 2026-09-07  
Starting SHA: `28e0c220ebc0797ec4944ed2f18def3e680dfaf5` (PR 13 tip)  
Development branch: `cursor/arc-night-opp-repair-2141-392f`  
Draft review: [PR 14](https://github.com/Morkeeth/arc-map/pull/14)

## Object exercised

`npm run test:opportunity-action` starts the packaged Anvil 1.7.1 binary on localhost with
fixture chain ID 31337. The script compiles `contracts/fixtures/OpportunityToken.sol` with
Solidity 0.8.36, injects its runtime and selected-account balance through Anvil test methods,
then pins the current local block. There is no contract-deployment transaction.

The selected account, fixture asset, approved report-contract target, amount and ceiling,
expiry, evidence source, counterevidence, and exact ERC-20 `transfer` calldata are committed
by one binding hash. The simulator re-derives that binding before its first RPC request.

The final positive receipt at 2026-09-07T19:49:30Z reported:

- local chain ID `31337`, block `0`, block hash
  `0xa442c92e1404a1a49f0f30008519d1b6d8397b988bcd4df63a024bb02f04c4e1`;
- selected account balance `1000000 → 975000`, delta `-25000`;
- approved report-contract balance `0 → 25000`, delta `+25000`;
- amount `25000` under policy ceiling `30000`;
- successful ABI return value ending in `01`; and
- `broadcast: false`.

These figures came from that command's `eth_call` and `debug_traceCall` prestate diff. They
are fixture base units, not dollars, a copied product metric, or a public-chain observation.

## Negative and baseline proof

The control was deliberately run first:

```sh
npm run rehearse:opportunity -- --wrong-account
```

It exited 1 with `Selected account does not match the policy account binding.` and printed
`simulationRpcStarted: false`. The same input's naive baseline—plain viem ABI encoding—accepts
the transfer calldata because an encoder does not inspect account authorization, evidence,
target policy or expiry. The policy-bound arm rejects before local simulation.

Focused tests also change the approved target, expire the policy, remove counterevidence and
tamper with prepared calldata. They assert that tampered calldata reaches zero RPC methods.

## Zero-broadcast boundary

The opportunity module and proof script create no wallet client and expose none of
`sendTransaction`, `sendRawTransaction`, `writeContract` or `deployContract`. A source guard
tests that boundary. The only state setup uses local Anvil `setCode`/`setStorageAt`; the
opportunity itself uses `eth_call` and `debug_traceCall`, whose changes are not persisted.

This work does not call or extend `prepareMissionAction`, `openMission`, escrow funding or
escrow close. It does not enable a browser route.

## Commands and observed outcomes

| Command | Observed outcome |
| --- | --- |
| `npm run rehearse:opportunity -- --wrong-account` | Exited 1 before simulation RPC for wrong account binding. |
| `npm run test:opportunity-action` | 4 focused tests passed; local EVM call returned true and decoded balanced `-25000` / `+25000` deltas. |
| `npm test` | 89 passed, 0 failed. |
| `npm run typecheck` | Passed after correcting the local custom-RPC TypeScript boundary. |
| `npm run build` | Exited 0; 7 static pages generated and dynamic routes compiled. Existing viem dynamic-dependency and optional Privy Farcaster/Solana-module warnings remain. |
| `git diff --check` | Exited 0 as the final step of the combined done-when command. |

## Limitations and failures

- This is an isolated local-EVM fixture, not an Arc fork backed by a public RPC and not an Arc,
  testnet or mainnet receipt. Chain ID 31337 is the pinned fixture identity.
- The evidence fields are deterministic proof inputs, not a live finding. A successful transfer
  simulation does not establish that a target is safe, useful, owned by anyone, or available.
- The report-contract target is an approved receiving address in this proof; it does not need
  runtime code to receive ERC-20 balances.
- The first combined full check passed all 89 tests, then failed typecheck because viem's public
  RPC schema does not include Anvil's `eth_accounts` or `debug_traceCall`. The code now narrows
  those two local RPC boundaries explicitly; focused tests and typecheck subsequently passed.
- Installing the latest packaged Anvil and Solidity compiler exposed 12 repository audit
  advisories (1 low, 10 moderate, 1 high). This receipt does not claim those advisories resolved.
