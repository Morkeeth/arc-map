#!/usr/bin/env npx tsx
/**
 * HTTP path for saved Ship Hunter investigations against a running local server.
 * Usage: npx tsx scripts/test-ship-hunter-http.ts
 * Expects NEXT_PUBLIC_APP_ORIGIN (default http://127.0.0.1:3107).
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

// Must match NEXT_PUBLIC_APP_ORIGIN / missionAccess allowed origin (localhost, not 127.0.0.1).
const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3107";
const cookie = `arcmap_session=${randomBytes(32).toString("hex")}`;

async function req(path: string, init?: RequestInit & { cookieOverride?: string }) {
  const { cookieOverride, ...rest } = init || {};
  const response = await fetch(`${origin}${path}`, {
    ...rest,
    headers: {
      Origin: origin,
      Cookie: cookieOverride || cookie,
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers || {}),
    },
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function main() {
  const releases = await req("/api/repository/arc-node/releases");
  assert.equal(releases.status, 200, `releases status ${releases.status}`);
  assert.ok(releases.body.observation?.releases?.length >= 1, "arc-node releases");

  const empty = await req("/api/repository/circle-agent-stack/releases");
  assert.equal(empty.status, 200);
  // Empty must remain a list, never invented releases.
  assert.ok(Array.isArray(empty.body.observation.releases));
  if (empty.body.observation.releases.length === 0)
    assert.equal(empty.body.observation.publishedCount, 0);

  const latest = releases.body.observation.releases.find(
    (r: { draft: boolean; binaryAssets: number }) => !r.draft && r.binaryAssets > 0,
  );
  assert.ok(latest, "need a packaged release for the claim");
  const created = await req("/api/ship-investigations", {
    method: "POST",
    body: JSON.stringify({
      projectId: "arc-node",
      claim: `arc-node published ${latest.tag} with downloadable binaries`,
    }),
  });
  assert.ok([200, 502].includes(created.status), `create ${created.status}`);
  assert.equal(created.body.investigation.status, "observed");
  assert.equal(created.body.investigation.report.evidence.stance, "limited-support");
  const id = created.body.investigation.id;

  const listed = await req("/api/ship-investigations");
  assert.equal(listed.status, 200);
  assert.ok(listed.body.investigations.some((i: { id: string }) => i.id === id));

  const got = await req(`/api/ship-investigations/${id}`);
  assert.equal(got.status, 200);
  assert.equal(got.body.investigation.claim, created.body.investigation.claim);

  const rerun = await req(`/api/ship-investigations/${id}/observe`, { method: "POST" });
  assert.equal(rerun.status, 200);
  assert.ok(rerun.body.rerun, "rerun comparison appended");
  assert.equal(
    rerun.body.investigation.observationHash,
    created.body.investigation.observationHash,
    "pinned hash immutable",
  );

  const otherCookie = `arcmap_session=${randomBytes(32).toString("hex")}`;
  const other = await req("/api/ship-investigations", {
    method: "POST",
    cookieOverride: otherCookie,
    body: JSON.stringify({
      projectId: "circle-agent-stack",
      claim: "Agent Stack shipped v1.0.0 with starter-kit binaries",
    }),
  });
  assert.ok([200, 502].includes(other.status));
  if (other.body.investigation?.status === "observed") {
    assert.ok(
      ["insufficient-evidence", "not-supported"].includes(
        other.body.investigation.report.evidence.stance,
      ),
    );
  }

  const cross = await req(`/api/ship-investigations/${id}`, {
    cookieOverride: `arcmap_session=${randomBytes(32).toString("hex")}`,
  });
  assert.equal(cross.status, 404, "owner isolation");

  console.log(
    JSON.stringify(
      {
        ok: true,
        origin,
        arcReleases: releases.body.observation.releases.length,
        investigationId: id,
        evidence: created.body.investigation.report.evidence.stance,
        naive: created.body.investigation.report.naive.stance,
        disagreement: created.body.investigation.report.disagreement,
        rerunChanged: rerun.body.changed,
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
