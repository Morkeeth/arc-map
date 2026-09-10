<!-- STATE:start -->
## SHARED WORK STATE · revision ffabe397994e · rendered 2026-09-10 · scope repo arc-map
This repo's rows of the one shared work state. Authorities: todo.md (human), TASKS.yaml (ids), board clocks, Oscar's rulings (local only). Views such as GLANCE, SLASK and ZUP are adapters over the same revision.
**A CLOSED task stays closed. Do not requeue, re-verify or re-poll it.**
Before acting, record that you read this revision, exact session and exact rev: `python3 ~/CODE/fleet-ops/state/state.py ack --session <your session id> --consumer <claude|codex|cursor> --rev ffabe397994e`. In a cloud sandbox instead append `{"session":"<your session id>","consumer":"<claude|codex|cursor>","rev":"ffabe397994e","ts":"<iso>","stage":"acknowledged"}` to `.fleet/ACK.jsonl` in this repo and commit it.

### OPEN
- **ARCMAP-HOSTING** · ARC MAP: host it, judge URL · owner agent · `arc-map`
  - next: LAUNCH-OPERATIONS.md:18 says not deployed. A judge-openable URL before Thu 10 Sep 23:59 Stockholm. No runner produces this.

### ACKNOWLEDGED THIS REVISION: claude/dc8db26e-0366-4b4c-8309-460715de7fcb
<!-- STATE:end -->

# ARC MAP

## Settled product decision

ARC MAP combines a live Arc discovery map, evidence-backed narratives, and agent investigations.
The primary loop is Explore → understand a story → Hunt this → inspect findings → follow changes.
The first users are the founder and a coworker who already track Arc and use Robinhood-chain
projects as inspiration. This is a daily discovery tool, not primarily a competition leaderboard.
Do not reopen the idea slate. Keep the map and hunter in one product.

## Working rules

- If CLAUDE.local.md exists, read its local credential-handling instructions, never the secret file itself.
- Read README.md and docs/BRAND.md before changing the product.
- Never copy project-specific code, designs, data models or assets from previous entries.
- Use live source data or an explicit unavailable state. No invented users, activity, funds or findings.
- Retrieval timestamps are not event timestamps. Explorer counts are not active users.
- Districts are metadata-based navigation; map proximity is not an ownership or flow claim.
- A hunter reports sample size, time window, provenance and uncertainty. Never upgrade a sample to
  a complete history or infer ownership, motive or airdrop eligibility from counters.
- API/provider failures remain visible. Do not silently switch providers and retain the old label.
- Present planned integrations as planned. Explorer data does not satisfy Graph prize requirements.
- Follows persist in a private server workspace identified by a browser cookie. Finite thesis
  checks require a running worker. Do not imply account recovery, cross-device sync or shared access.
- No wallet transactions, public pushes, deployment or publishing are part of the repo kickoff.
- Run npm test, npm run typecheck, npm run build for changes to core evidence handling.
- Check the actual screen at desktop and phone widths for interface changes.

## Small PR cadence — user requirement, 6 September 2026

- Ship small, frequent, independently reviewable PRs during the hackathon; do not collect
  unrelated work into one large batch. This is the user's workflow, not an organizer rule.
- Pin each PR to the current default branch; check open PRs and concurrent owners first.
- State the concrete behavior change and checks. Draft PR creation is authorized; root review
  remains required before merge. This does not authorize deployment, spending or wallet actions.
- Next separate slices: thesis failure/quiet-cycle status; worker restart/status integration;
  returning evidence through restarted workers; desktop/phone acceptance of any changed interface.
  Recheck current branches before starting each slice; this list does not assign its owner.

## Hunter build boundaries

- Read docs/HUNTER-EXECUTION.md before changing missions, payments or agent tools.
- Research is rules-based; do not call it autonomous AI decision-making.
- Graph transfer queries use GRAPH_TRANSFERS_URL and the Transfer schema, not the old token schema.
- Local Anvil receipts are not Arc receipts. Funding controls remain closed without verified configuration.
- Wallet funds pay for fixed-price research, not investment shares. No Hunter token has been issued.
- Preserve the testnet-only contract guard, expected-report commitment and owner refund controls.
- Run contract and lifecycle tests when changing escrow behavior. Never use a user key in local tests.

## Readiness

Start with README.md, docs/AGENT-GUIDE.md and docs/VERIFICATION.md for current behavior and evidence.
Historical planning sections are not present-tense deployment claims. If a local .internal/
agent plan exists, keep it out of Git, containers and public review prompts.
Sponsor choice is Arc + The Graph + Privy, contingent on live evidence and an actual funded-hunt
wallet flow. Do not add token speculation or airdrop farming to create sponsor fit.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
