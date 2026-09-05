# Overnight build — 2026-09-05

User direction: continue autonomously while the user sleeps. Keep the ambitious product,
not just a verified plumbing demo. Existing project, not a new hackathon idea or entry.

## Product promise

Open ARC MAP, spot a change worth investigating, make a testable claim, send a Hunter,
then see whether the evidence moves for or against that claim. Humans and agents use the
same source-linked tools. A new visitor can explore before connecting a wallet.

Three surfaces: **Radar** (what changed), **Theses** (what might happen and why),
**Hunters** (investigate, monitor, act within explicit authority).

The signature is a thesis with a visible evidence trail that changes over time—not a
project directory, a raw transaction feed, an unexplained score or a token badge.

## Execution rules

- Autonomous implementation, no routine review pauses. Verify each working slice.
- Maintain one working tree and one primary implementation lane. Do not overlap writers.
- Keep live truth separate from plans; record actual commands and outputs at slice boundaries.
- Existing authorization: publish `arcmap` to Graph Studio; deploy/test research escrow on
  Arc testnet; total conservative transaction spend cap 1 native testnet USDC including gas,
  with a 0.05 mission. Do not reuse this authorization for other contracts or trades.
- No paid hosting, domains, paid model/API requests, public source push, mainnet transactions,
  pooled investments or public token launch without the relevant separate authority.
- Secrets remain outside git. Private wallet/run records remain under ignored local storage.
- Design stays light blue, DM Sans, professional, mobile-first. No giant hero or mascots.

## Checkpoints

- [x] **01. Publish the real data/payment foundation**
  Spec ref: `HUNTER-EXECUTION.md > Research / Payment contract`
  What to build: Studio deployment, verified Arc testnet contract and explicit readiness API.
  Acceptance: Graph returns actual indexed transfers; deployed runtime matches compiled contract;
  stale data does not unlock payment. Do not claim the full payment lifecycle yet.
  Verify: `npm run check:integrations`, Foundry tests, browser Graph research.

- [x] **02. Complete the capped live research payment**
  Spec ref: `HUNTER-EXECUTION.md > Payment contract`
  What to build: resumable, one-shot run after the historical index reaches current Arc state.
  Acceptance: 0.05 funded; exact report commitment settled for 0.01; 0.04 reclaimed; all receipts
  on Arc; cumulative authorization retained across restarts. No duplicate broadcast on uncertainty.
  Verify: `tsx scripts/arc-testnet-release.ts --lifecycle`; inspect persisted receipt state.
  Browser Privy authorization is a separate unverified path if the user has not connected.

- [x] **03. Turn the directory into a discovery radar**
  Spec ref: Product promise > Radar
  What to build: persist discovered Arc token/contracts from live explorer responses, with
  first-observed time, source timestamp when available, contract identity and measured changes.
  Add search, category/type filters and a clear distinction between curated and discovered.
  Acceptance: new source records appear without editing `projects.ts`; duplicate observations
  do not create fake launches; copied names never become official project associations.
  Verify: bounded live ingestion plus persistence, deduplication and outage tests; inspect phone UI.

- [x] **04. Open the Hunter to discovered contracts**
  Spec ref: Product promise > Hunters
  What to build: allow the explorer Hunter to inspect a sourced discovered contract, while
  Graph availability remains restricted to addresses actually indexed by the deployed subgraph.
  Acceptance: select a live radar item → research → inspect evidence and limits. Unsupported
  Graph coverage is explicit, never empty data presented as a valid broad index.
  Verify: real selected token through browser and MCP; invalid/unindexed target tests.

- [x] **05. Add thesis records, evidence and resolution rules**
  Spec ref: Product promise > Theses
  What to build: saved private theses with target, claim, explicit observable criterion,
  horizon, pinned baseline, new evidence checks and a timeline. Attach research results.
  Acceptance: claim and resolution rule cannot move after creation; new evidence appends;
  unknown/error is not failure; outcome measures the stated criterion, not project success.
  Verify: restart/retrieval, ownership isolation, pinned baseline and due-resolution tests.

- [ ] **06. Add the Ship Hunter and comparison tools**
  Spec ref: Product promise > Hunters
  What to build: inspect linked repository changes and releases; compare a declared shipping
  claim with observed source evidence. Keep code activity separate from deployment and adoption.
  Acceptance: a user can investigate both a contract and a verified repository with a clear
  mandate, source dates and useful findings. No arbitrary URL fetching or invented X access.
  Verify: live GitHub response, malformed timestamps, source mismatch and API outage checks.

- [ ] **07. Give agents the entire research workflow**
  Spec ref: `HUNTER-EXECUTION.md > Agent access`
  What to build: MCP radar search, target inspection, thesis creation, research, evidence checks
  and timeline retrieval. Tool outputs state source freshness and available coverage.
  Acceptance: an AI can find a target and choose useful tools from their descriptions. Invalid
  or hostile source text cannot gain execution rights. Calls share owner-scoped records.
  Verify: actual model-directed tool use plus SDK compatibility and owner-isolation tests.
  Do not describe a fixed SDK test as an independent AI evaluation.

- [x] **08. Add recurring research with hard limits**
  Spec ref: Product promise > follow the evidence
  What to build: explicit opt-in schedules, finite check count, minimum interval, durable leases,
  append-only observations, cancellation and a clear next-check time. Initially read-only/free.
  Acceptance: restart cannot duplicate work; cancellation prevents later checks; failures remain
  visible; a graph outage never switches providers. No recurring financial charge is inferred.
  Verify: controlled-clock worker tests, stop/restart and two-worker contention checks.

- [x] **09. Make the thesis desk clear on phone and desktop**
  Spec ref: `BRAND.md > Structure / Interaction`
  What to build: one selected thesis, its trajectory and next action; compact source indicators;
  fresh contract radar with density controls. Reuse the same data/API for agent and human views.
  Acceptance: a new visitor finds a target, reads a claim, opens its evidence and starts a Hunter
  without a wallet. No anonymous activity or synthetic growth is presented as actual usage.
  Verify: drive the complete UI flow at desktop and 390 CSS pixels; inspect actual screenshots.

- [x] **10. Implement a separate strategy-backing sandbox**
  Spec ref: long-term user direction > invest in a Hunter's thesis
  What to build: explicit design and local test contracts for capital-backed strategies, distinct
  from research fees. Define assets/shares, valuation, allowed calls, loss accounting, withdrawals,
  cancellation and emergency exits before any token can represent a claim on assets.
  Acceptance: local tests show deposit/shares/redeem, adverse outcomes and failed execution.
  A token alone is not an investment product. No real money, public market or live deployment.
  Verify: local EVM tests and adversarial accounting review. Do not weaken research escrow guards.

- [ ] **11. Prepare a persistent public launch**
  Spec ref: `HUNTER-EXECUTION.md > Live launch checkpoints`
  What to build: persistent storage/backups, collector/worker isolation, request limits, privacy
  review and deployment instructions with actual hosting requirements. Shared wallet accounts need
  verified Privy server authentication and scoped/revocable agent access before public paid use.
  Acceptance: a production build survives process restart and restores data; unavailable hosting,
  X bearer/access, model credentials or wallet login remains plainly identified.
  Verify: production HTTP, restore test and source/bundle secret scan. External spend requires approval.

## Ambition after the night

- Multiple Hunters can test opposing claims against the same pinned evidence, with a history
  showing what each got right. No invented probabilities; scoring requires resolved forecasts.
- A working strategy share gives its holder defined asset/redemption rights, not just branding.
- Verified contract integrations can route a mint or another bounded action from a thesis. A label
  or copied ABI never proves that a contract belongs to a project or is safe to call.
- Robinhood-chain observations can form a separately sourced comparison view. Do not label an
  analogous Arc project as a deployment/partnership or copy another project's code/licensing.
- X contributes sourced claims only once actual API access is available. OAuth client credentials
  alone do not provide a search feed, and paid calls need a budget.

## Verified checkpoint — 2026-09-04 23:47 UTC

- Graph caught up. The one-shot authorized Arc testnet lifecycle completed without weakening
  freshness checks: 0.05 funded, 0.01 fee, 0.04 reclaimed; total gas 0.0262614 native testnet USDC.
  The operator CLI path is verified; Privy browser payment is not.
- Radar collected 165 distinct observed records by 23:47 UTC. These are not 165 official projects
  or launches. The browser researched TAPUSDC: 50 sampled transfers, 50 distinct transactions.
- One SUN thesis was created through the browser, baseline 100,001 transfers. Its first manual
  check was unchanged. The finite worker schedule remains active; no future result is claimed.
- 37 application tests, 12 research-escrow tests and 11 isolated strategy tests passed.
  TypeScript and production build passed. Four local database snapshots passed integrity checks.
- MCP SDK flow verified all 13 tools were advertised; exercised radar, repository, mission and
  thesis create/check/read/cancel. This is a protocol test, not an independent model evaluation.
- Desktop and 390-CSS-pixel thesis/radar layouts inspected. Latest text-button fixes inspected.
- Source and client-bundle scan found no saved secret values. Private data stays ignored.

Open checkpoints are deliberately not marked complete: repository release/claim comparison,
independent model evaluation, and persistent public-host
restore/authentication verification still need work. Ship Hunter currently examines commits only.
No public domain, hosting, mainnet deployment or public investment token was purchased/launched.

Follow-up at 23:50 UTC: the generic Counter contract completed a browser preview with one
successful subsequent call. Arcscan also returned the deployment transaction; it is now explicitly
excluded and regression-tested. The primary coding agent selected this target through the shared
tool layer and ran an explorer mission; this is not a separate-model review. Returning visitors
now open their latest saved thesis automatically. Same-name radar rows show contract fragments.
Production HTTP checks returned 200 for discovery, theses, agents, radar and integration health.
An eight-hour idle-sleep inhibitor is running to support the local workers; closing the laptop
can still interrupt them. No unbounded financial worker is running.

## NIGHT-2026-09-05 intervention slice — 2026-09-04 23:58 UTC

The experiment's frozen baseline is `587ddc9` plus its recorded dirty tree at 23:24:25 UTC.
Earlier capabilities above were already in flight or completed before this brief arrived; do
not attribute all night commits to the intervention. The persistent goal is now active through
08:00 Paris or verified completion of the authorized brief. No new financial authority.

New slice: server-persisted private follows, ticket-scoped review windows and immutable report
reruns/comparisons. The source sequence, not observation timestamps, defines unread records;
an old response arriving late is not lost. Reading/refreshing cannot acknowledge a window.
Legacy local follows migrate without deleting their local copy. Clearing the workspace cookie
still loses access; this is not cross-device identity.

`scripts/test-follows-http.ts --wait` followed USDC/EURC and Wrapped USDC at 23:56:41 UTC,
observed one actual listing change by 23:57:42, and acknowledged only that saved window.
Owner isolation and invented-ticket rejection fired. The official SDK exercised 18 advertised
tools, including rerun/compare and follow/review; no separate model result is claimed yet.
41 application tests, typecheck and build passed. Browser connection repeatedly timed out;
the new interface is implemented but its visual flow is not yet verified. Next: restore browser
verification, link saved Hunter evidence into theses, and run an independent bounded agent client.

## Evidence attachments and independent agent — 2026-09-05 00:10 UTC

Theses now retain owned, same-contract Hunter reports with their original content commitments.
Attaching research does not change the locked rule, schedule or outcome. The browser attached
a real Graph report to its existing SUN thesis. Its automatic 00:07 UTC check recorded an
unchanged counter of 100,001, preserving the baseline and consuming one scheduled check.

A separate signed-in Cursor agent ran the discovered MCP tools through an isolated local bridge:
discover → choose SUN/Graph → research → retrieve → create a finite thesis → retrieve. Its first
thesis confused an absolute counter target with the required increase. This was a semantic
failure despite successful tool responses. The API/tool schema now states the increase semantics
and returns the resolved absolute target. The same agent detected the mismatch, cancelled the
original without rewriting it, and created/retrieved a correct one-check replacement. Twelve
bounded tool calls in total; no wallet action. A separate read-only-mode attempt refused the
local mutation and did not call the bridge. This is a narrow workflow evaluation, not a general
claim of reliable autonomous reasoning. The bridge trace and model metadata remain private.

Browser checks: persistent SUN follow and fixed Changes baseline; attach report; rerun Graph
report and inspect before/after commitments. The conclusion remained unchanged even though the
retained transaction example changed as the index advanced. This is not new September activity:
both event samples are historical. Actual 390-CSS-pixel Changes layout has no horizontal overflow;
desktop report comparison inspected. The browser viewport override was reset.

42 application tests, TypeScript, production build and the 19-tool official SDK flow pass.
`scripts/test-restore.ts` restored all four actual database snapshots into a separate standalone
production process. Saved follows and review baseline matched; the generated static asset and
private thesis route returned 200. This is local process/restore evidence, not a container or
public-host test. User acceptance and Privy browser payments remain unverified.
