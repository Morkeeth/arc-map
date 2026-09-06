# CLOUD RECEIPT — ARC shared investigation · 2026-09-06

## Identity
- **Starting SHA:** `490696286b5ca08844940e5f957e4133fc3462c7`
- **Branch:** `cursor/arc-shared-investigation-2232-0645`
- **Draft PR:** https://github.com/Morkeeth/arc-map/pull/9
- **Cloud agent:** `bc-b6c5c1f6-9fd4-4d96-8332-0ba504e24114`
- **Cloud run:** `run-cbd02650-42d3-4401-8aeb-6b10b5a3d490`

## Changed user ability
A researcher can deliberately share **one completed Hunt/investigation**. A second session accepts the invite, adds **sourced counterevidence**, and both see the return decision move to **reassess** without mutating the original report. Owner can **revoke**; prior counterevidence remains for the owner.

## Commands run (supervisor local on PR tip)

| Check | Command | Result |
|---|---|---|
| Unit + store dual-session | `npm test` | **73 pass / 0 fail** |
| HTTP dual-session API | included in `npm test` (`shared-investigation-http.test.ts`) | **pass** |
| Typecheck | `npm run typecheck` | **pass** |
| Build | `npm run build` | **pass** (`/api/investigation-share` present) |

## Browser / phone pixels
**Partial / honest:** collaboration UI is wired in `workspace.tsx` (share controls, counterevidence form, list, revoke). Full desktop + 390px screenshot pass against a live dual-browser session was **not** completed in this supervisor slice; store + HTTP dual-session prove the research interaction without bypassing access controls.

## Limitations
- Auth is cookie `arcmap_session` (existing facility), not a full recoverable account product.
- One invite acceptor per invite token; share is per completed mission only.
- No wallet/trading changes; hosting-ready ≠ hosted.
- Cloud agent may still append receipt/visuals before deadline; this receipt closes the verification gap named in the draft PR body.

## Do not claim
- Public production deploy
- Auth-only night without research value (research path is present)
- Cold hosted multi-device recovery as shipped
