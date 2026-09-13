# Shared investigation — browser acceptance

Base: d3404ecdcc85d6fe2906a7dc62c8a7572863a0b0. This change carries PR9 onto current main while retaining Today, thesis, inbox, funding-policy and supervised-runtime behavior.

An owner shares one completed Hunter report. A contributor opens it in a separate browser workspace, adds a public source and bounded challenge, and the owner's Today card requests reassessment. Revocation blocks future reads and contributions while keeping prior counterevidence and original report bytes/hash.

## Reproduced defects and repairs

- A fresh contributor could accept the invite before the initial follows request established its cookie. A delayed follows response then replaced that cookie, losing access to the shared report. Acceptance now follows workspace establishment and leaves a reloadable mission URL. Failed cookie setup does not consume the invite.
- Re-sharing silently replaced an active contributor. The API now requires explicit revocation before another invite can be created. Preserved contributions survive replacement.
- Acceptance committed before constructing its response. A later read failure attempted rollback outside a transaction and masked the original error. The read now occurs before commit; failure rolls back acceptance and keeps the invite usable.
- Current main adds private policy and funding records to missions. Contributor responses omit these and the prior-mission link; owner records remain unchanged.
- The shared reassessment status has its own field. It does not replace existing retained policy/coverage decisions in Today.

## Actual browser journey

On 13 September, two isolated Chromium cookie contexts used the local app and a real Arcscan SUN report: 50 transfer events, 1 distinct transaction. No Graph claim, wallet, credential or broadcast was involved. The contributor's source note explicitly bounded the sample; it was test-entered commentary, not independent expert validation.

The browser flow delayed the real cookie-establishing response by 1.5 seconds, accepted the invite, submitted sourced counterevidence, reloaded the contributor page, returned to the owner's Today reassessment, reopened the report, then revoked access. Subsequent contributor read returned 404 and write returned 400. The owner retained one contribution and the original report/hash.

Owner and contributor screenshots were captured and opened at 1280 and 390 pixels, plus the owner Today card. No horizontal overflow was measured at either width. This is local browser evidence, not a deployed multiuser service or adoption evidence.

## Repeat

Use Node 22 and an isolated checkout/database. Install the locked app dependencies. Start the app with `NEXT_PUBLIC_APP_ORIGIN=http://localhost:3157 NEXT_PUBLIC_RESEARCH_PREVIEW=1 node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3157`.

Run `node scripts/test-shared-investigation-browser.mjs` with Playwright available. If Playwright is installed outside this project, set `ARCMAP_PLAYWRIGHT_MODULE` to its `index.mjs` path. `ARCMAP_BROWSER_ORIGIN` and `ARCMAP_BROWSER_EVIDENCE` override the origin and screenshot directory. The script creates a real read-only explorer mission and isolated browser sessions, fails explicitly if the provider is unavailable, and always closes its browser. It does not start the app or workers.

Unit/HTTP checks include scoped access, one-use acceptance, revocation, restart retention, report hash preservation, active-invite protection, failed-read rollback and owner-only record exclusion. Existing retained-decision tests remain intact.
