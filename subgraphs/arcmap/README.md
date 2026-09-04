# arcmap — Arc Testnet transfer index

Initialized with Graph CLI 0.98.1 for the user's Studio slug `arcmap`.
This first index captures SUN ERC-20 Transfer logs. It is not a full Arc ecosystem index,
a holder-count index, or a claim that this project already qualifies for a prize.

## Local verification

Use Node 22. From this directory:

```sh
npm install
npm run codegen
npm run build
```

The generated Matchstick test scaffold is separate from the build. Do not report those tests
passing unless `npm test` actually succeeds on the installed platform.

## Source and coverage

- Network: `arc-testnet`, chain ID 5042002.
- Token: `0x02A0545E0f6Dce7E0Fb68Bc4ed0e9688e29e6Ee1` (SUN).
- Start block: 49195767, verified against the creation transaction on 2026-09-04.
- Creation transaction: https://testnet.arcscan.app/tx/0xf0e2aa89e7c278ba24f277fb1d7ef8839c903c0d740e6d55279698a14f49b858
- Network documentation: https://thegraph.com/docs/en/supported-networks/arc-testnet/

Entities preserve token address, transaction hash, log index, block number and event timestamp.
Amounts are raw integer token units. Addresses do not establish unique people or common ownership.
This indexes emitted Transfer logs, not all possible storage changes or wallet activity.
No labels or balances are hard-coded into reported findings.

## Deployment and integration boundary

The deploy key is stored outside git; see the repository's ignored CLAUDE.local.md for its pointer.
Do not print the key, pass it in process arguments, or use it as a browser/query API key.
No deployment or onchain publishing is performed by initialization or build.

The app's existing Graph adapter expects a `tokens` discovery schema. This first index exposes
`transfers` instead. Do not configure it as GRAPH_SUBGRAPH_URL yet: the hunter needs a dedicated
transfer query adapter, and discovery still needs its own token schema/provider.

## Submission checks derived from the supplied Graph prize text

Target: Best AI Tooling or AI Use Case, From Scratch, subject to event originality eligibility.

1. Deploy to a live Graph provider and verify indexing health and progress.
2. Query real transfer entities and compare transaction/log identities against Arcscan.
3. Make THE HUNT use these results for meaningful investigation, with explicit sample limits.
4. Demonstrate an actual AI/tool interaction, not just this index or a raw query result.
5. Supply public source, clear setup instructions and a 2–4 minute video at submission time.

This one subgraph does not by itself qualify for the composability/standardization track.
Local codegen/build are not evidence of live indexing, authentication or prize eligibility.

## Verification record — 2026-09-04

`graph init arcmap`, codegen and WASM build completed successfully. The Next.js app's typecheck,
five evidence tests and production build also passed after excluding this AssemblyScript package
from the frontend TypeScript project. Matchstick tests have not been run.

The isolated Graph CLI dependency tree reports 16 npm audit findings: 5 moderate, 10 high and
1 critical. A non-breaking `npm audit fix` did not clear them. The critical report concerns
`decompress` archive extraction; this is a tooling dependency, not proof of an exploited application.
No forced dependency downgrade was applied. Review/mitigate these findings before authenticated
deployment, and do not feed untrusted archives to the CLI. The stored deploy key was not supplied
to the CLI during this initialization or verification.
