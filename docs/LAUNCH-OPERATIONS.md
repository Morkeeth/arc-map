# Launch operations

## Current boundary

The web app and three read-only workers run locally. Graph indexing and the fixed-fee research
escrow are on Arc testnet. The source repository is public. This release candidate has no
verified public web hosting, mainnet deployment, live investment token or browser wallet-payment flow.

`npm run dev` starts the web app on 3107. Run `ingest:watch`, `radar:watch` and `theses:watch`
as separate processes. They must remain running on an awake machine. A closed laptop is not
a scheduler. The release watcher is a one-shot payment verification tool, not a settlement service.

## Persistent host

Use the Dockerfile target `all` for a host with one persistent volume per service. It runs
Next.js and the worker supervisor in one process tree and stores data at `/app/.data`.
The supervisor manages curated collector, radar and thesis workers. An unexpected web or
supervisor exit stops the whole service with a nonzero exit; the host must restart it.
`railway.toml` specifies ON_FAILURE with ten retries and `/api/workers` as the health path.
A normal termination stops the owned process groups and exits cleanly.

The separate-service `compose.yaml` remains available for local operation on one Docker host.
It binds web to localhost:3117. Both arrangements need HTTPS termination for public access.
Build with the real `NEXT_PUBLIC_APP_ORIGIN` and configure that origin in Privy before
browser authentication testing. Inject server credentials at runtime.

On 11 September 2026 the single-service image was built and checked locally: web and supervisor
failure caused nonzero exit and restart, normal stop exited cleanly, and replacement with
the same named volume retained data. These checks do not establish hosted TLS, platform volume
retention or browser wallet authentication.

Do not copy `.env.local`, deployment keys, wallet exports, private release state or backups into
the image. `.dockerignore` excludes local data. Runtime Graph query credentials are separate
from the Studio deploy key. Never give a collector or web process the user's wallet key.

Before public paid use: verify server-side Privy authentication, account ownership, scoped and
revocable agent access, distributed request limits, TLS and cookie configuration, and browser
fund/settle/refund end to end. The opaque local cookie is not a wallet-authenticated account.
Do not enable automatic settlement merely because a contract address is configured.

## Backup and restore

`npm run backup` snapshots the four application SQLite databases into ignored `.data/backups`.
It uses SQLite `VACUUM INTO`, not a raw copy that omits live WAL contents, and checks each
snapshot's integrity. Snapshot directory permissions are 0700 and database permissions 0600.
Mission and thesis snapshots are private. There is no automatic upload or deletion policy.
The one-time wallet release database is intentionally excluded.

To restore, stop the web and all workers. Preserve the existing data directory as a recoverable
copy. Restore the chosen snapshot into a **new** data directory, with its matching database
names; do not mix old WAL/SHM files with restored databases. Start the app against that directory
using `ARCMAP_DB_PATH`, `ARCMAP_RADAR_DB`, `ARCMAP_MISSIONS_DB` and `ARCMAP_THESES_DB`
as applicable. Verify source health and a saved record before restarting schedules.

Snapshots are individually consistent, not a transaction across all four databases. Mission
records refer to sourced project IDs; keep the radar snapshot with its mission/thesis snapshots.

## Safety gates that must remain

- Graph freshness is evaluated against an independently read chain clock; stale data cannot fund.
- Source outage is unknown, not zero. Graph never silently switches to Arcscan.
- Finite thesis checks are read-only, owner-scoped and lease-fenced. Cancelling prevents completion.
- Research fees do not buy investment shares. A report hash commits bytes, not truth.
- Strategy sandbox accepts chain 31337 only and has a separate compiler configuration.
- Public launch and a domain still need the user's selected account/domain and spending authority.
