# Account recovery / cross-device — gap + first probe

Status: **not implemented**. Cookie workspaces remain device-local.

## What exists today

- Opaque `arcmap_session` HttpOnly SameSite cookie → SHA-256 owner key
- Owner-scoped missions, theses, follows, Ship Hunter investigations
- Agent bearer token is a **separate** workspace (`agent:<hash>`), not a user recovery path

## First failing probe (executed)

```sh
npx tsx scripts/probe-workspace-recovery.ts
```

Observed:

- Same cookie can read its Ship Hunter investigation (`200`)
- A second cookie cannot (`404`)
- A cleared/replaced cookie cannot (`404`)
- `POST /api/account/recover` does not exist (`404`)

That is the cross-device / recovery gap. It is not a bug in isolation; it is missing product.

## Design choices (Oscar decides — do not guess-implement auth)

1. **Privy subject binding** — after verified server-side Privy auth, map `privyUserId` → workspace owner. Enables cross-device when the same Privy login is used. Requires Privy verification secret + session validation (not only the public app id).
2. **Exportable recovery secret** — show a one-time workspace secret the user stores; redeeming it re-binds a new cookie to the old owner hash. No email. Phishable if displayed carelessly.
3. **Email magic-link ticket** — needs a mail provider and spend authorization.

## Constitution reminders

- Do not imply browser watchlists or investigations sync across devices before one of the above ships.
- Do not treat wallet address alone as workspace ownership without an explicit bind + revocation story.
- Scoped/revocable agent access remains a separate launch checkpoint from `HUNTER-EXECUTION.md`.
