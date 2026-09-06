import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MissionStore } from "../src/lib/mission-store";
import type { MissionReport } from "../src/lib/hunters";
import { POST as sharePost } from "../src/app/api/investigation-share/route";
import { lastHuntReturn } from "../src/lib/last-hunt-return";

const ORIGIN = "http://localhost:3107";

const REPORT: MissionReport = {
  version: 1,
  hunter: "distribution",
  thesis: "Does the sample extend beyond one transaction?",
  conclusion: "The bounded sample contains more than one transaction.",
  stance: "limited-support",
  provider: "explorer",
  source: "test fixture",
  observedAt: "2026-09-06T20:00:00.000Z",
  indexedBlock: null,
  sampleSize: 2,
  transactions: 2,
  firstEventAt: "2026-09-06T18:00:00.000Z",
  lastEventAt: "2026-09-06T19:00:00.000Z",
  evidence: [
    {
      transaction: `0x${"a".repeat(64)}`,
      block: 1,
      from: `0x${"1".repeat(40)}`,
      to: `0x${"2".repeat(40)}`,
      timestamp: "2026-09-06T18:00:00.000Z",
      logIndex: 0,
    },
    {
      transaction: `0x${"b".repeat(64)}`,
      block: 2,
      from: `0x${"3".repeat(40)}`,
      to: `0x${"4".repeat(40)}`,
      timestamp: "2026-09-06T19:00:00.000Z",
      logIndex: 0,
    },
  ],
  observations: ["Two distinct transactions were returned."],
  limitations: ["This fixture is not a complete activity history."],
  steps: [{ tool: "fixture", result: "Two bounded rows." }],
};

function session() {
  const token = randomBytes(32).toString("hex");
  return {
    owner: createHash("sha256").update(token).digest("hex"),
    cookie: `arcmap_session=${token}`,
  };
}

function shareRequest(cookie: string, body: Record<string, unknown>): Request {
  return new Request(`${ORIGIN}/api/investigation-share`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      cookie,
    },
    body: JSON.stringify(body),
  });
}

test("HTTP dual-session share → counterevidence → revoke (isolated DB)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arcmap-dual-http-"));
  const dbPath = join(dir, "missions.sqlite");
  const previousDb = process.env.ARCMAP_MISSIONS_DB;
  const previousOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  process.env.ARCMAP_MISSIONS_DB = dbPath;
  process.env.NEXT_PUBLIC_APP_ORIGIN = ORIGIN;
  try {
    const owner = session();
    const contributor = session();
    const stranger = session();

    const seed = new MissionStore(dbPath);
    const mission = seed.create(owner.owner, {
      projectId: "sun-token",
      provider: "explorer",
      budget: "0.05",
    });
    seed.claim(owner.owner, mission.id);
    const finished = seed.finish(owner.owner, mission.id, REPORT, null);
    seed.close();

    const createRes = await sharePost(
      shareRequest(owner.cookie, {
        action: "create",
        missionId: mission.id,
      }),
    );
    assert.equal(createRes.status, 201);
    const created = (await createRes.json()) as { invite: { token: string } };

    const acceptRes = await sharePost(
      shareRequest(contributor.cookie, {
        action: "accept",
        token: created.invite.token,
      }),
    );
    assert.equal(acceptRes.status, 200);

    const secondAccept = await sharePost(
      shareRequest(stranger.cookie, {
        action: "accept",
        token: created.invite.token,
      }),
    );
    assert.equal(secondAccept.status, 400);

    const ceRes = await sharePost(
      shareRequest(contributor.cookie, {
        action: "counterevidence",
        missionId: mission.id,
        sourceUrl: "https://example.com/source-record",
        note: "This source shows the two rows belong to one bounded publication event.",
      }),
    );
    assert.equal(ceRes.status, 201);
    const challenged = (await ceRes.json()) as {
      mission: {
        reportHash?: string | null;
        collaboration?: { counterevidence: unknown[] };
      };
    };
    assert.equal(challenged.mission.collaboration?.counterevidence.length, 1);
    assert.equal(challenged.mission.reportHash, finished.reportHash);
    assert.equal(
      lastHuntReturn([challenged.mission as never])?.decision,
      "reassess",
    );

    const revokeRes = await sharePost(
      shareRequest(owner.cookie, {
        action: "revoke",
        missionId: mission.id,
      }),
    );
    assert.equal(revokeRes.status, 200);

    const denied = await sharePost(
      shareRequest(contributor.cookie, {
        action: "counterevidence",
        missionId: mission.id,
        sourceUrl: "https://example.com/after-revocation",
        note: "This contribution must not be accepted after revocation.",
      }),
    );
    assert.equal(denied.status, 400);

    const check = new MissionStore(dbPath);
    assert.equal(check.getVisible(contributor.owner, mission.id), null);
    assert.equal(check.getVisible(stranger.owner, mission.id), null);
    assert.equal(
      check.getVisible(owner.owner, mission.id)?.collaboration
        ?.counterevidence.length,
      1,
    );
    check.close();
  } finally {
    if (previousDb === undefined) delete process.env.ARCMAP_MISSIONS_DB;
    else process.env.ARCMAP_MISSIONS_DB = previousDb;
    if (previousOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_ORIGIN;
    else process.env.NEXT_PUBLIC_APP_ORIGIN = previousOrigin;
    rmSync(dir, { recursive: true, force: true });
  }
});
