# Cloud receipt — external wallet / Graph / simulation seam

Date: 2026-09-07  
Starting object: `c985b0ef7fcce23939c767a147a02b7e47115fd3`  
Development branch: `cursor/arc-night-wallet-graph-2108-ad60`  
Status: verified locally; results below were observed on this branch.

## 1. Wallet connection and current interactions

The mounted connector is `WalletProvider` in `src/app/layout.tsx`, implemented by
`src/components/wallet-provider.tsx`.

- Outside research-preview mode, it mounts Privy's React provider with both `email` and
  `wallet` login methods. Privy may expose an external wallet or create an embedded Ethereum
  wallet for a user who logs in without one.
- There is no separate wagmi connector. ARC MAP takes the first authenticated Privy wallet,
  asks it for an EIP-1193 provider, and gives that provider to a viem wallet client.
- The implemented transaction interactions are only the prepared Arc-testnet escrow actions:
  `fund` calls `openMission`; `close` calls `closeMission`. Before a send, the browser checks
  the prepared account, expiry and Arc-testnet chain, asks the wallet to switch chain, sends
  the server-prepared transaction, and waits for one receipt. The server separately checks
  escrow bytecode, mission state, evidence freshness and contract simulation.
- In `NEXT_PUBLIC_RESEARCH_PREVIEW=1`, Privy is not mounted, wallet controls and payment tools
  are omitted, the provider defaults to explorer research, and both chain-route methods return
  403. This slice does not change that behavior.

Therefore an external wallet can be selected through Privy's wallet login outside preview
mode; the public research preview cannot connect or transact. This is not verified browser
funding, account recovery, mainnet support or an automatic executor.

## 2. The Graph and explorer on the live research path

The sources have distinct jobs:

| Path | Source at the owning object | Coverage and failure behavior |
| --- | --- | --- |
| Discovery/radar | Arcscan testnet API in `src/lib/providers/explorer.ts` | Bounded explorer token listings, counters and recent transfer pages. Not a complete project/activity index. |
| Distribution Hunter with `provider: graph` | `GRAPH_TRANSFERS_URL` through `src/lib/providers/graph-transfers.ts` | The deployed `Transfer` schema, currently for the configured SUN contract only. A missing, non-HTTPS, rejected, malformed or indexing-error response blocks the mission; explorer is not substituted. |
| Distribution Hunter with `provider: explorer` | Arcscan token counters and transfer page | Explicit free explorer preview. It has no Graph-index block and cannot unlock escrow funding. |
| Activity Hunter | Arcscan incoming contract transactions | Explicit explorer-only bounded sample; it is not token-transfer or Graph coverage. |

The Graph query requests transaction hash plus log index, token, endpoints, block number and
event timestamp, as defined in `subgraphs/arcmap/schema.graphql`. The adapter requests one
continuation sentinel beyond its retained sample, rejects unrelated/future/duplicate-invalid
records, and reports whether more data exists. Reports distinguish event timestamps from
`observedAt` and expose the indexed block.

Reachability alone is not freshness. `src/lib/index-freshness.ts` compares the Graph indexed
block timestamp with a contemporaneous Arc RPC block and the current clock. Invalid, future,
stale-RPC, ahead-of-chain and historical-index observations fail closed. The funding path
repeats that check at preparation time and then simulates the exact escrow call.

The baseline arm is the existing Arcscan path, not data produced by this change. A future live
comparison may honestly show different bounded samples because the providers have different
pagination, index state and observation times; equal counts are neither expected nor evidence
that either source is complete.

## 3. What “September 16” refers to

Exact official source found:

- Circle press release, 2026-08-05:
  https://www.circle.com/pressroom/circle-announces-founding-validator-cohort-and-major-integrations-for-arc-ahead-of-september-16-mainnet-launch

The release says Arc is “on track for a public mainnet launch on September 16, 2026.” It is
the network's planned **public mainnet launch**, not an ARC MAP deadline or evidence that the
public mainnet is already live. The same release says features may be modified, delayed or
cancelled.

Current-state cross-check:

- Arc homepage: https://www.arc.network/

At retrieval on 2026-09-07, the homepage says “Mainnet is coming soon” and “Live on public
testnet.” ARC MAP must continue using its explicit Arc-testnet chain and guard until a separate
mainnet version is reviewed; this receipt does not authorize changing the chain route.

Runnable source checks:

```sh
curl -fsSL 'https://www.circle.com/pressroom/circle-announces-founding-validator-cohort-and-major-integrations-for-arc-ahead-of-september-16-mainnet-launch' \
  | rg -o 'public mainnet launch on September 16, 2026|modified, delayed, or cancelled' \
  | sort -u
curl -fsSL 'https://www.arc.network/' \
  | rg -o 'Mainnet is coming soon|Live on public testnet' \
  | sort -u
```

## 4. Local unsigned rehearsal

`encodeUnsignedMissionAction` is now the single calldata encoder used by production
`prepareMissionAction` for allowlisted `fund` and `close` actions. The local command calls that
encoder with deterministic fixtures, decodes the result against the checked-in escrow ABI, and
prints calldata and value. It creates no wallet client, reads no key, performs no RPC request,
and exposes no broadcast option.

```sh
npm run rehearse:mission
```

The negative control must first be observed exiting nonzero:

```sh
npm run rehearse:mission -- --action send
```

The passing test then pins both allowlisted encodings and rejection of a missing report
commitment or unknown action:

```sh
node --import tsx --test tests/mission-action.test.ts
```

This rehearsal proves ABI encoding and the allowlist only. It does **not** claim a successful
EVM simulation, configured deployment, current Graph index, authenticated wallet, sufficient
balance, accepted wallet prompt or transaction receipt. Production preparation still performs
those checks against Arc testnet; no production send is invoked here. No syscall-level network
trace was available, so the no-RPC claim is bounded to the executed code path and command output.

## Positive and negative checks

| Command run | Observed result |
| --- | --- |
| `npm run rehearse:mission -- --action send` | Exited 1 at `Unsupported wallet action.` after dependencies were installed. This is the observed-red allowlist control. |
| `npm run rehearse:mission` | Exited 0; decoded `openMission` fixture calldata and reported no signer, RPC or broadcast. |
| `node --import tsx --test tests/mission-action.test.ts` | 3 passed: fund encoding, zero-value close encoding, missing-report and unknown-action rejection. |
| Circle source `curl … \| rg -o … \| sort -u` above | Exited 0 and returned both the September 16 public-mainnet target and the modification/delay/cancellation warning. |
| Arc homepage `curl … \| rg -o … \| sort -u` above | Exited 0 and returned both “Live on public testnet” and “Mainnet is coming soon.” |
| `NEXT_PUBLIC_RESEARCH_PREVIEW=1 node --import tsx --input-type=module -e '…GET/POST route probe…'` | GET and POST each returned 403 with `Wallet actions are unavailable in this research preview.` |
| `npm test` | 85 passed, 0 failed. |
| `npm run typecheck` | Exited 0. |
| `npm run build` | Exited 0; all pages generated. Existing viem dynamic-dependency and optional Privy Farcaster/Solana-module warnings remain. |
| `git diff --check` | Exited 0 before the pre-verification commit. |

Failures retained:

- The first unsupported-action run exited 127 at `tsx: not found`; this did not count as the
  negative control. `npm ci` installed the checked-in dependency tree, after which the exact
  command exited 1 for the intended allowlist rejection.
- The first direct preview-route probe assumed named ESM exports and failed with
  `route[method] is not a function`. The corrected probe used the loader's default export and
  observed both 403 responses.

## Explicit boundaries

- No live funds or wallet key.
- No transaction broadcast or Arc receipt.
- No deployment, publish, submission, new spend or repository visibility change.
- No public-preview wallet enablement.
- No mainnet route.
- No PR 9 merge or change.
- Research escrow remains fixed-price research payment, not opportunity execution, custody,
  investment ownership or a token.
