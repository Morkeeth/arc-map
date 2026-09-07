# hack.md — ARC MAP · 2026-09-07

Contract for this build. A box is truth only when its done-when was RUN.

## NORTH STAR

Open Today, spot a lead that is still warm, understand why it deserves a Hunter **now**,
run one concrete thesis check, and leave with either a supported finding plus an inspectable
local action proposal — or an explicit unsupported result. No live funds.

## PROMISE LINE

**Gets:** a discovery → Hunt → informed-action path where “why now” uses original activity and
source clocks, counterevidence stays visible, and a supported Hunter result unlocks a reviewable
simulation/checklist (never a wallet send).

**Constraint:** discovery quality ≠ raw token activity ≠ financial return; every claim is
sourced, sampled, and bounded.

## OPEN QUESTIONS

- **Blocking:** none for this phase. Live Graph/explorer may be unavailable; the path must
  degrade to an honest unavailable state rather than inventing leads or findings.
- Non-blocking: whether naive volume ranking beats editorial “why now” on today’s retained
  set (answered by the baseline arm; either outcome is a finding).
- Non-blocking: Privy browser funding remains out of scope for this lane.

## CONSTITUTION

1. Do not touch PR #9 / `cursor/arc-shared-investigation-*`. Work from `main` only.
2. No wallet / trading / mainnet / new keys / inferred spend / production deploy.
3. No fabricated novelty, fake live metrics, or silent provider switches.
4. Never carry a number from a prompt or receipt — re-derive at the object.
5. Never rank by title/name alone; open the evidence object.
6. A checkbox is false until its done-when command has been executed and recorded.
7. Outward publish/submit/merge-to-main is Oscar’s click. Draft PR + feature push only.
8. Small PRs, one user outcome each. No giant rewrite or restructure.

## PLAN (risk-first)

### Slice 1 — Why-NOW clocks + action proposal + baseline rank arm *(NOW)*
**Risk:** Closing the loop without inventing urgency or circular self-rank; action proposals
must be inspectable and non-financial; baseline volume arm may beat us.

**Build:**
- Pin a public-safe candidate set from live brief/radar (or honest unavailable).
- Surface **why NOW** from original event/observation clocks + cooling window + counterevidence
  (not transfer volume or name).
- One Hunter thesis run → supported / not-supported / insufficient with sample/window/provenance.
- If supported: generate an inspectable **action proposal** (local simulation / review checklist).
- Ship a **naive volume-rank baseline** compared against editorial why-now order (can lose).

**Done-when (must RUN):**
- [x] Candidate pin / unavailable recorded at object (`npm run radar`; `npm run ingest`; brief dump)
- [x] Unit tests for why-now clocks, action proposal gating, baseline comparison (`npm test`)
- [x] `npm test && npm run typecheck && npm run build`
- [x] Desktop + ~390px notes (screenshots in artifacts)
- [x] Receipt `docs/CLOUD-RECEIPT-arc-discovery-hunter-2026-09-07.md`

### Slice 2 — Thesis failure/quiet-cycle status (separate PR; not this NOW)
Owned by concurrent lanes / later slice. Do not batch into slice 1.

### Slice 3 — Worker restart evidence return (separate PR; not this NOW)
Same rule: independent PR after slice 1 ships.

## NOW

**Slice 1 only.** Why-NOW → one Hunter → action proposal + baseline volume arm.

## LOG

- Session start: HEAD `490696286b5ca08844940e5f957e4133fc3462c7` matches expected start SHA.
- `hack.md` was missing; written as first deliverable before code.
- Open PRs at start: #9 (do not touch), #1 (unrelated returning-user test).
- Ideation (3 candidates → pick) recorded in receipt after pin.
- Ran `npm run radar` + `npm run ingest` → pinned 128 brief cards / 123 catalog records.
- Shipped why-NOW clocks, action proposals, discovery-rank baseline arm, loopback origin repair.
- Done-when commands executed:
  - [x] Candidate pin — `npm run radar`; `npm run ingest`; brief object dump → `/tmp/candidate-pin.json`
  - [x] Unit tests — `npm test` (78 pass) including why-now / action-proposal / discovery-rank
  - [x] `npm test && npm run typecheck && npm run build`
  - [x] Desktop + ~390px — browser screenshots in `/opt/cursor/artifacts/`
  - [x] Receipt `docs/CLOUD-RECEIPT-arc-discovery-hunter-2026-09-07.md`
- Live eval: `npm run eval:discovery-rank` → why-now beat volume on hot/warm share (1.0 vs 0.25).
- Live Hunt: `node --import tsx scripts/eval-hot-hunt.ts` → limited-support + ready proposal.
- Repair: Origin `127.0.0.1` vs `localhost` blocked browser Hunt; `originAllowed` + explorer auto-select.
- Stopped after slice 1 verification; did not start slice 2/3.
