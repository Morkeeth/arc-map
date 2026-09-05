#!/usr/bin/env npx tsx
/**
 * First failing probe: opaque cookie workspaces are not cross-device accounts.
 *
 *   npx tsx scripts/probe-workspace-recovery.ts
 *
 * Requires a running app (default http://localhost:3107).
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3107";

async function call(cookie: string, path: string, init?: RequestInit) {
  const response = await fetch(`${origin}${path}`, {
    ...init,
    headers: {
      Origin: origin,
      Cookie: cookie,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  return { status: response.status, body: await response.json(), setCookie: response.headers.get("set-cookie") };
}

async function main() {
  const cookieA = `arcmap_session=${randomBytes(32).toString("hex")}`;
  const cookieB = `arcmap_session=${randomBytes(32).toString("hex")}`;

  const created = await call(cookieA, "/api/ship-investigations", {
    method: "POST",
    body: JSON.stringify({
      projectId: "arc-node",
      claim: "arc-node published v0.8.0 with linux binaries",
    }),
  });
  assert.equal(created.status, 200, `create failed ${created.status}`);
  const id = created.body.investigation.id as string;
  assert.equal(created.body.investigation.status, "observed");

  const sameDevice = await call(cookieA, `/api/ship-investigations/${id}`);
  assert.equal(sameDevice.status, 200, "same cookie must read its investigation");

  const otherDevice = await call(cookieB, `/api/ship-investigations/${id}`);
  assert.equal(
    otherDevice.status,
    404,
    "different cookie must NOT see the investigation — this is the cross-device gap",
  );

  // Cleared cookie = new random session = lost workspace (no recovery ticket exists).
  const cleared = await call(
    `arcmap_session=${randomBytes(32).toString("hex")}`,
    `/api/ship-investigations/${id}`,
  );
  assert.equal(cleared.status, 404, "cleared cookie loses access");

  // Negative control: there is no recovery endpoint today.
  const recovery = await fetch(`${origin}/api/account/recover`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ ticket: "probe" }),
  });
  assert.equal(
    recovery.status,
    404,
    `expected missing recovery route, got ${recovery.status}`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        finding:
          "Workspace identity is an opaque HttpOnly cookie. Clearing it or opening another browser loses Ship Hunter / mission / thesis records. No /api/account/recover exists.",
        probe: {
          sameCookie: sameDevice.status,
          otherCookie: otherDevice.status,
          clearedCookie: cleared.status,
          recoveryRoute: recovery.status,
        },
        nextDesignChoices: [
          "Privy-authenticated subject bound to workspace owner hash (needs server-side Privy verification)",
          "Exportable workspace recovery secret shown once (local-first, no email)",
          "Email magic-link recovery ticket (needs mail provider + spend)",
        ],
        implementedTonight: "failing probe + documented gap only",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
