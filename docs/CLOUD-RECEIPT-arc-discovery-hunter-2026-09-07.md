# Cloud receipt — ARC MAP discovery → Hunter → action proposal

**Date:** 2026-09-07  
**Lane:** Monday A1 (public-safe)  
**Starting SHA:** `490696286b5ca08844940e5f957e4133fc3462c7` (confirmed via `git rev-parse HEAD`)  
**Branch:** `cursor/arc-discovery-hunter-2026-09-07-196a`  
**PR:** draft registration requested (user-approval create flow); do not merge  

## Ideation (3 → 1)

Compared against README / Today / Hunters / thesis surfaces, `docs/HUNTER-EXECUTION.md`, and live brief after `npm run radar` + `npm run ingest`.

1. **Why-NOW clocks + Hunt action proposal + naive volume baseline arm** — closes Explore → why now → Hunt → informed action; baseline can beat us. **Selected.**
2. Multi-observation emerging-cluster detector across radar — valuable, but does not complete the action loop.
3. Auto-draft thesis from supported Hunt — overlaps thesis desk; weaker for “act now”.

Did not reopen the product slate. Did not touch PR #9 / `cursor/arc-shared-investigation-*`.

## Candidate pin (before edits)

Commands:

```sh
git rev-parse HEAD
npm run radar
npm run ingest
node --import tsx -e '…dailyBrief()…'  # wrote /tmp/candidate-pin.json
```

Observed at object (re-derived, not carried from the prompt):

- Brief: **128** grouped cards; catalog **123** radar records; sources fresh.
- Editorial top (pre-change) elevated cold GitHub code (Agent Stack event 2026-08-28) above minutes-old activity — the gap this slice targets.
- Naive volume top: USDC / EURC / WUSDC by holder counts (millions) — distinct from discovery urgency.

## What shipped

- `hack.md` contract (was missing; written before code).
- `src/lib/why-now.ts` — cooling from original event clocks; observation ≠ event.
- `src/lib/daily-brief.ts` — Why-NOW fields + sort: cooling → kind → signal clock (not holders/names).
- `src/lib/action-proposal.ts` + UI panel — ready checklist only for `limited-support`; withheld otherwise; forbids live funds.
- `src/lib/discovery-rank.ts` + `npm run eval:discovery-rank` — why-NOW vs naive volume arm.
- `scripts/eval-hot-hunt.ts` — one live Activity Hunter on a hot lead.
- Loopback CSRF repair: `originAllowed` treats `localhost`/`127.0.0.1` as one host for the configured port (`npm run dev` binds 127.0.0.1 while `.env.example` documents localhost). Auto-select explorer when Graph does not cover the target.

## Verified at object (commands)

| Claim | Command / object | Result |
| --- | --- | --- |
| Start SHA | `git rev-parse HEAD` | `490696286b5ca08844940e5f957e4133fc3462c7` |
| Live pin | `npm run radar` / `npm run ingest` | 125 radar inserts; 3 ingest inserts |
| Why-NOW vs volume | `node --import tsx scripts/eval-discovery-rank.ts` | whyNowHotShare **1** vs volumeHotShare **0.25**; winner `why-now`; overlap **0** |
| Hot Hunt → proposal | `node --import tsx scripts/eval-hot-hunt.ts` | `0xf3bf…` limited-support; sample 50 / 50 txs; proposal **ready** |
| Unsupported withhold | explorer Distribution on SUN | stance `not-supported`; proposal **withheld** |
| Origin repair | POST `/api/missions` with `Origin: http://127.0.0.1:3107` | create+run → reported limited-support |
| Unit tests | `npm test` | **78** pass |
| Types | `npm run typecheck` | pass |
| Build | `npm run build` | pass |
| Desktop UI | browser @ 1280 | Why-NOW HOT lead visible; Hunt report + action proposal section |
| Phone UI | browser @ ~390 CSS px | Why-NOW + withheld proposal; no horizontal overflow noted |

Artifacts: `desktop_why_now_hot_lead.webp`, `phone_390_why_now_hot_lead.webp`, `desktop_hunt_action_proposal_withheld.webp`, `phone_390_hunt_action_proposal_withheld.webp`.

## Limits

- No wallet, mainnet, deploy, merge, or PR #9 edits.
- Graph transfers URL not configured in this environment; explorer path used.
- Browser Hunt on a hot *code* verification lead returned `insufficient-evidence` (honest withhold). Supported+ready proposal verified via `eval-hot-hunt.ts` and HTTP run on a hot activity contract.
- Draft PR creation is gated on user approval in this cloud settings mode.

## Wrong / incomplete

- First browser Hunt hung: diagnosed as Origin `127.0.0.1` ≠ allowed `localhost` — not a Graph outage. Fixed after the fact; earlier “Graph hang” diagnosis was wrong until the Origin object was opened.
- Pre-change I nearly trusted editorial order without opening event clocks; the pin proved cold code outranked hot activity.
- Volume arm did **not** beat why-NOW on this night’s hot/warm share (why-now won 1.0 vs 0.25). The fixture test still forces a path where volume can win; live loss-to-baseline did not occur tonight.
- Did not ship a second/third independent draft PR (thesis quiet-cycle / worker return remain separate lanes).
- `next-env.d.ts` may show a local dirty touch from `next build`/`dev`; not intentional product change.
