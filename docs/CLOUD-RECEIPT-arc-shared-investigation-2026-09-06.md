# ARC MAP shared investigation receipt — 6 September 2026

## Scope

- Repository: `Morkeeth/arc-map`
- Starting SHA: `490696286b5ca08844940e5f957e4133fc3462c7` (matched local `HEAD`)
- Requested branch: `cursor/arc-shared-investigation-2026-09-06`
- Environment-mandated branch used: `cursor/arc-shared-investigation-2232-0645`
- Draft PR: https://github.com/Morkeeth/arc-map/pull/9
- No deploy, wallet connection, spend, transaction, main push or merge was performed.

## User ability delivered

An owner can create a one-use link for one completed Hunt. Acceptance binds that Hunt to one
other opaque browser workspace; it does not expose the owner's other missions, follows, theses
or wallet controls. The contributor can append a public HTTP(S) source URL and a bounded
counterevidence note. The original report JSON, evidence rows and report hash remain unchanged.
Both visible views change the research decision from `provisional` to `reassess`.

The owner can revoke the active invite. The contributor then loses read and contribution access,
while their prior counterevidence remains in the owner's persisted record.

## Checks and observed evidence

| Check | Result |
| --- | --- |
| `npm test` | 73 tests passed, including store and HTTP invite isolation, stranger denial, append-only counterevidence, restart persistence and revocation |
| `npm run typecheck` | Passed |
| `npm run build` | Passed with Next.js 16.3.4 |
| `git diff --check` | Passed |
| live local three-session HTTP flow | Owner, contributor and stranger had distinct cookies; invitee saw exactly one shared Hunt; owner's second Hunt stayed hidden; stranger saw none |
| live Arcscan report | 50 sampled transfer rows, one distinct transaction, explicit `explorer` provider |
| original commitment | Report hash remained identical after contribution |
| revocation | Contributor mission list returned zero shared missions after owner revocation |

The live HTTP flow used transaction
`0x46f7d2ce427a2ff68271604853bdfcf86f8b868cb9497bcf3914e54c6a6c956a`
from the report itself as the contributed source. The note challenged interpretation of the
bounded sample; it did not claim a new event or complete activity history.

The valid owner report was reviewed at a 1,259 CSS-pixel desktop viewport
(`scrollWidth` 1,244) and a responsive viewport configured near 390 CSS pixels
(`innerWidth` and `scrollWidth` both reported as 398). No horizontal overflow was observed.

## Commands

```sh
git rev-parse HEAD
gh pr list --state open --limit 30
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

The isolated-session proof called the local same-origin routes for follows, mission creation and
execution, `/api/investigation-share`, mission listing and mission detail. It used the live
Arcscan provider and performed no chain or wallet route. A separate route-handler test exercises
the same dual-session share, contribution and revoke path against an isolated database.

## Limitations and blocked proof

- This is deliberate capability sharing between cookie workspaces, not account identity,
  recovery, general cross-device synchronization or a public report.
- One completed investigation can have one active contributor invite. There are no named users,
  notifications, contributor discovery or multi-person roles.
- Source URLs are constrained to credential-free public HTTP(S) hosts but are not fetched or
  independently endorsed when contributed.
- Revocation removes the contributor's access. It does not erase their already-preserved
  counterevidence from the owner's research record.
- The automated and live HTTP proofs cover persistence and authorization. Existing follow
  persistence behavior was unchanged and remained covered by the full suite.
- A first browser walkthrough used a synthetic explorer response and fabricated source URL. It
  was rejected, its local database and environment override were deleted, and its screenshots
  are not evidence. The single repair reran against live Arcscan.
- In that repaired isolated-browser walkthrough, invite acceptance succeeded but the operator
  did not complete contributor navigation to the report. End-to-end contributor UI interaction
  is therefore **BLOCKED as manual browser proof**. The same scoped accept, contribute, owner
  return and revoke sequence passed through three actual cookie sessions over the local HTTP API.
- No production deployment, public abuse controls or independent security review was attempted.
