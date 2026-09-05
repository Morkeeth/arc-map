# Verification record — 5 September 2026

Application scope: Today, research inbox and renewable monitoring slice, following `0e553fa`.
Earlier contract and restore results below were run at `3c46bf8`, not rerun for this UI slice.
Checks ran locally on Node 22; they are not a public deployment
or an independent security audit. User acceptance remains separate from automated verification.

## Current check results

| Check | Observed result |
| --- | --- |
| `npm test` | 52 application tests passed |
| `npm run typecheck` | Passed |
| `npm run build` | Production build passed |
| `npm run test:agent` | Official MCP SDK discovered 25 tools and exercised live brief, isolated inbox, foreign-update rejection, contract, release, thesis, follow and comparison flows |
| `npm run test:contracts` | 12 escrow tests passed |
| `npm run test:strategy` | 11 local-only strategy tests passed |
| `npm run test:lifecycle` | Isolated local Anvil funding, fixed fee, commitment, duplicate/unauthorized rejection and refund passed |
| `scripts/test-restore.ts` | Four actual SQLite snapshots restored into a separate standalone production process; follows and review baseline matched; static asset and thesis route returned 200 |
| `git diff --check` | Passed |

The restore run completed at 08:27:46 UTC. It is not a Docker lifecycle or public-host test.
Foundry also reported timestamp-comparison lint warnings in the escrow's deadline checks.
These tests do not resolve all dependency, custody, operational or security risks.

## Today and return visits

At 09:12:13 UTC, the live local HTTP check returned 81 grouped leads from retained observations.
An isolated SUN thesis used a real Arcscan counter baseline of 100,001, completed its single
check and remained inconclusive. Its monitoring-ended update survived reads until explicit
acknowledgment. Another workspace could not acknowledge it. A new round pinned the original
commitment and a fresh baseline; the original stayed unchanged. The new round was cancelled.
Run `node --import tsx scripts/test-daily-flow.ts` to repeat this non-financial flow.

The browser opened the exact existing thesis from its inbox update and displayed its 16
completed checks. The new-round form locked the original claim and criterion. Today and the
form were inspected at 390 CSS pixels with document width 390; the viewport override was reset.
The new-round creation was exercised through HTTP, not submitted again through the browser.

Tests cover duplicate transaction identities, same-name/different-address separation, original
event dates, source failures, invalid/future health timestamps, quiet-check suppression,
failure/recovery events, owner isolation, explicit review and immutable new-round links.
The first extended MCP test hit a test-client JSON parsing assumption on a valid plain-text
error response. The client now handles MCP error text; the full live protocol test then passed.
These are rules-based research leads, not AI-generated investment rankings or a full-chain census.

## Browser release investigation

On the actual development app, select Curated projects → Arc node → Inspect repository.
GitHub returned a real release list including `v0.8.0`. A stable-release investigation was
saved at 08:28:12 UTC and rechecked at 08:28:33 UTC. Both observations returned a published
stable release; the saved comparison correctly showed unchanged release data and repository head.

Evidence: [Arc node v0.8.0](https://github.com/circlefin/arc-node/releases/tag/v0.8.0) and its
[exact-tag API response](https://api.github.com/repos/circlefin/arc-node/releases/tags/v0.8.0).
The publication date returned was 28 August 2026, 11:19:08 UTC—not the date of the investigation.
No network upgrade was inferred. Desktop and 390-CSS-pixel layouts were inspected;
document width matched 390 pixels. The temporary viewport override was reset.

Release tests deliberately reject drafts, mismatched tags, future timestamps, unsafe source
associations, stale observations, another owner's baseline and mismatched release criteria.
Prereleases, missing releases and source errors produce distinct results. Restart retains the
original report, and a later investigation cannot rewrite it. Request limits were seen to fire.

## Earlier verified product flows

- Durable follows: a live source change was recorded after following, then only the captured
  review window was acknowledged. Reading and refreshing preserved the baseline.
- Graph report rerun: both original report commitments survived. A different retained historical
  transaction example did not become a claim of new September activity or a growth rate.
- Thesis research: a real same-contract Graph report was attached through the browser without
  changing the criterion, baseline or schedule.
- Finite monitoring: a separate agent's one-check thesis ran at 00:21:41 UTC. SUN remained at
  100,001 transfers; the check allowance exhausted and the result stayed inconclusive. This
  was not proof of inactivity or a failed forecast about the entire remaining horizon.

## Live integration probe

At 08:02:24 UTC, Arc RPC returned block 60,547,167 and Graph indexed block 60,547,161.
The live Graph query returned 200 sampled events and passed the configured freshness checks.
The deployed escrow runtime matched the configured code. Browser wallet authentication was
false; mainnet and the automatic executor remained disabled. These are dated observations,
not an evergreen health claim. Run `npm run check:integrations` for current state.

The previously authorized **Arc testnet** operator CLI lifecycle completed with a 0.05 native
USDC budget, 0.01 fixed fee and 0.04 returned surplus. Gas including deployment was 0.0262614
native testnet USDC. This is distinct from the current **local Anvil** verification above.
Private wallet-run records are not included in this repository. No new Arc transaction was
performed for this source-push verification.

## Independent-agent evaluation

A separate Cursor client performed bounded live Graph research and created a finite thesis.
Its first interpretation treated a delta threshold as an absolute target: successful tool
calls, wrong executable rule. The API was changed to return the resolved criterion explicitly.
The agent then identified the mismatch, cancelled the first record, created the intended
replacement and retrieved it. Twelve bounded calls in total; no signing or payment tool.

The first read-only client mode refused local mutations and made no bridge calls. This failed
approach is retained in the private evaluation record. The official SDK test is separate from
this model-directed evaluation. Neither proves broad agent reliability or prompt-injection safety.

## Publication and remaining gaps

Outgoing Git history, tracked files and generated browser assets were checked for exact matches
to configured project secrets and the wallet address. None were found in the checked bytes.
Private databases, local credential instructions and `.internal/` are excluded. This check is
not a guarantee against unknown secrets or a full security review.

Still unverified or unimplemented: public hosting, Docker runtime lifecycle, account recovery,
cross-device/shared identity, authenticated Privy browser payment, X ingestion, wider Graph
coverage, independent contract audit, mainnet deployment and competition eligibility. Source
publication is not an application launch. License choice also remains to be declared before
claiming a permissively licensed open-source release.
