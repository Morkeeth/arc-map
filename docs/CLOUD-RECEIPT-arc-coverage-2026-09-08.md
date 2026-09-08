# ARC N-U3 coverage receipt — 2026-09-08

Starting ref: `day/2026-09-08-arc-coverage`  
Starting SHA: `11004255f268fbce53c85b5a89ac86d02da2e577`

## Delivered

- Every completed contract mission retains a coverage decision bound to its exact address,
  provider, report observation time and report hash.
- The Hunters UI distinguishes `supported`, `unsupported`, `stale` and
  `counterevidence-heavy`. Reopening a mission recalculates the current status while preserving
  the original receipt.
- Funding preparation now evaluates coverage before escrow configuration or RPC access. A
  withheld target cannot become a transaction merely because a wallet is connected.
- An eligible mission shows the selected linked wallet as embedded or external. An unsupported
  mission shows the coverage stop instead of asking the user to connect a wallet.

The four statuses mean:

| Status | Decision |
| --- | --- |
| `supported` | Exact contract is in the deployed Graph transfer index, the report is within 15 minutes and its bounded sample has limited support. Policy preparation may proceed to separate wallet, chain and escrow checks. |
| `unsupported` | Exact contract lacks deployed Graph coverage or the retained report is an explicit explorer preview. Funding is withheld. |
| `stale` | Graph report observation is invalid, in the future or older than 15 minutes. A new immutable mission is required. |
| `counterevidence-heavy` | The bounded Graph sample is not supported or insufficient. Funding is withheld even when the target is indexed. |

## UnitFlow acceptance

The bounded radar collector returned **UnitFlow USDC (uUSDC)** at
`0x142ec8437f645baef1b3683f2065f53a26285a7a`. An explicit Arcscan Distribution Hunter preview
observed 50 transfer events across 50 distinct transactions at `2026-09-08T21:26:10.695Z`.
The sampled event window was `2026-09-08T12:54:15Z` to `2026-09-08T17:19:30Z`.

That sample produced `limited-support`, but the separate data-coverage decision was
`unsupported / withheld`: the deployed Graph index covers SUN, not UnitFlow. A direct funding
preflight returned HTTP 409 with the same reason before chain configuration was consulted.
Explorer evidence was not relabeled as Graph evidence.

The UI states what would be required:

1. Deploy and verify a Transfer-schema Graph index containing the exact UnitFlow contract.
2. Run a new Graph Distribution Hunter report retaining its indexed block, sample size, event
   window, source links and limitations.
3. Compare Graph freshness with current Arc RPC state during policy preparation.
4. Require a limited-support result after inspecting concentration, repeated-operator and
   distribution counterevidence.

The production page was inspected at 1280 × 900 and 390 × 844 CSS pixels. Both showed UnitFlow,
the unsupported status, explicit funding stop, eligibility requirements and retained coverage
receipt. Document width did not exceed either viewport. After restarting the production process,
the same private browser workspace reopened UnitFlow with the same retained receipt and stop.

## Verification

- `npm test` — 97 passed, 0 failed.
- `npm run typecheck` — passed after the final build.
- `npm run build` — passed. Existing optional Privy/Farcaster and viem Tempo warnings remain.
- `git diff --check` — passed.

The first production build exposed a client/server boundary: the static Graph-address predicate
imported the server-only radar/SQLite catalog. One repair moved that predicate to the static
project catalog; the rebuilt production bundle passed. A typecheck launched concurrently with a
build briefly saw the build replacing `.next/types`; the required sequential final typecheck
passed.

## Boundaries

The Arcscan page is bounded evidence, not a complete history, active-user count, ownership claim,
safety finding or investment recommendation. `limited-support` does not override missing Graph
coverage. The retained receipt records a rules-based eligibility decision, not an onchain receipt.

No wallet signature, funds, transaction broadcast, deployment, publication, new spend or
repository visibility change occurred. No private workspace cookie, mission identifier, personal
data, wallet address or private run trace is included here.
