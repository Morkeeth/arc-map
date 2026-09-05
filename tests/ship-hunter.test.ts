import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseGitHubReleases,
  summarizeReleases,
} from "../src/lib/providers/releases";
import {
  claimTokens,
  evaluateShipClaim,
  evidenceArm,
  naiveTagArm,
} from "../src/lib/ship-claim";
import { ShipStore, hashObservation } from "../src/lib/ship-store";

const fixtures = join(process.cwd(), "fixtures/ship-hunter");
const adversarial = JSON.parse(
  readFileSync(join(fixtures, "adversarial.json"), "utf8"),
) as Record<string, unknown[]>;
const arcFixture = JSON.parse(
  readFileSync(join(fixtures, "arc-node-releases.json"), "utf8"),
) as unknown[];

function observationFrom(projectId: string, repo: string, payload: unknown) {
  const releases = parseGitHubReleases(payload, repo);
  return summarizeReleases(
    projectId,
    repo,
    `fixture://${repo}`,
    releases,
    "2026-09-05T08:00:00.000Z",
  );
}

test("release parser keeps publish time, assets and rejects future timestamps", () => {
  const [release] = parseGitHubReleases(adversarial.withAssets, "circlefin/arc-node");
  assert.equal(release.tag, "v0.8.0");
  assert.equal(release.binaryAssets, 1);
  assert.equal(release.checksumAssets, 1);
  assert.equal(release.publishedAt, "2026-08-28T11:19:08.000Z");
  assert.throws(() => {
    const row = adversarial.withAssets[0] as Record<string, unknown>;
    parseGitHubReleases(
      [{ ...row, published_at: "2099-01-01T00:00:00Z" }],
      "circlefin/arc-node",
    );
  });
  assert.throws(() => parseGitHubReleases({ not: "array" }, "circlefin/arc-node"));
});

test("empty release list is insufficient for both arms — never a green zero", () => {
  const empty = observationFrom("circle-agent-stack", "circlefin/agent-stack-starter-kits", []);
  assert.equal(empty.publishedCount, 0);
  const report = evaluateShipClaim(
    empty,
    "Agent Stack shipped v1.0.0 with starter-kit binaries",
  );
  assert.equal(report.evidence.stance, "insufficient-evidence");
  assert.equal(report.naive.stance, "insufficient-evidence");
  assert.equal(report.winner, "both-insufficient");
  assert.equal(report.sampleSize, 0);
});

test("evidence arm refuses tag-only releases that naive latest-tag would accept", () => {
  const tagOnly = observationFrom("arc-node", "circlefin/arc-node", adversarial.tagOnly);
  const claim = "arc-node shipped v9.9.9 for operators";
  const evidence = evidenceArm(tagOnly, claim);
  const naive = naiveTagArm(tagOnly, claim);
  assert.equal(naive.stance, "limited-support", "naive matches latest tag string");
  assert.equal(evidence.stance, "not-supported", "evidence requires binary assets");
  const report = evaluateShipClaim(tagOnly, claim);
  assert.equal(report.disagreement, true);
  assert.equal(report.winner, "evidence");
});

test("draft-only match is not published shipping evidence", () => {
  const draft = observationFrom("arc-node", "circlefin/arc-node", adversarial.draftOnly);
  const report = evaluateShipClaim(draft, "Release v1.2.3 is available to download");
  assert.equal(report.evidence.stance, "not-supported");
  assert.match(report.evidence.conclusion, /draft/i);
});

test("arc-node fixture supports a real packaged release claim", () => {
  const liveish = observationFrom("arc-node", "circlefin/arc-node", arcFixture);
  assert.ok(liveish.publishedCount >= 1);
  assert.ok(liveish.withBinaries >= 1);
  const tokens = claimTokens("circlefin/arc-node published v0.8.0 with linux binaries");
  assert.ok(tokens.includes("v0.8.0"));
  const report = evaluateShipClaim(
    liveish,
    "circlefin/arc-node published v0.8.0 with linux binaries",
  );
  assert.equal(report.evidence.stance, "limited-support");
  assert.equal(report.evidence.matchedTag, "v0.8.0");
});

test("claim without version tokens refuses title-rank", () => {
  const liveish = observationFrom("arc-node", "circlefin/arc-node", adversarial.withAssets);
  assert.throws(() => claimTokens("short"), /8/);
  const report = evaluateShipClaim(
    liveish,
    "The repository looks very active and important lately",
  );
  assert.equal(report.tokens.length, 0);
  assert.equal(report.evidence.stance, "insufficient-evidence");
  assert.match(report.evidence.conclusion, /title-rank|token/i);
});

test("ship store pins immutable observation, isolates owners, appends reruns", () => {
  const store = new ShipStore(":memory:");
  try {
    const created = store.create("owner-a", {
      projectId: "arc-node",
      claim: "arc-node published v0.8.0 with linux binaries",
    });
    assert.equal(created.status, "created");
    assert.ok(created.claimTokens.includes("v0.8.0"));
    const first = observationFrom("arc-node", "circlefin/arc-node", adversarial.withAssets);
    const pinned = store.pinObservation("owner-a", created.id, first);
    assert.equal(pinned.status, "observed");
    assert.equal(pinned.report?.evidence.stance, "limited-support");
    assert.throws(() => store.pinObservation("owner-a", created.id, first), /immutable/);
    assert.equal(store.get("owner-b", created.id), null);
    assert.equal(store.list("owner-b").length, 0);

    const changedPayload = JSON.parse(JSON.stringify(adversarial.withAssets));
    (changedPayload[0] as { assets: { name: string }[] }).assets.push({
      name: "extra-tool.tar.gz",
      size: 12,
      content_type: "application/gzip",
      browser_download_url:
        "https://github.com/circlefin/arc-node/releases/download/v0.8.0/extra-tool.tar.gz",
      digest: null,
    } as never);
    const second = observationFrom("arc-node", "circlefin/arc-node", changedPayload);
    assert.notEqual(hashObservation(first), hashObservation(second));
    const { investigation, rerun } = store.appendRerun("owner-a", created.id, second);
    assert.equal(rerun.changedFromPinned, true);
    assert.equal(investigation.reruns.length, 1);
    assert.equal(investigation.observationHash, pinned.observationHash);
    assert.equal(investigation.claim, created.claim);
    assert.throws(
      () => store.block("owner-a", created.id, "nope"),
      /immutable/,
    );
  } finally {
    store.close();
  }
});

test("ship store rejects projects without sourced repos and bad claims", () => {
  const store = new ShipStore(":memory:");
  try {
    assert.throws(
      () =>
        store.create("o", {
          projectId: "sun-token",
          claim: "something shipped v1.0.0 somehow",
        }),
      /sourced repository/,
    );
    assert.throws(
      () => store.create("o", { projectId: "arc-node", claim: "tiny" }),
      /8/,
    );
  } finally {
    store.close();
  }
});

test("GitHub outage and non-OK responses stay RED — no invented releases", async () => {
  const { inspectReleases, clearReleaseCache } = await import(
    "../src/lib/providers/releases"
  );
  const original = globalThis.fetch;
  clearReleaseCache();
  try {
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    await assert.rejects(() => inspectReleases("arc-node"), /failed|substitute/i);
    clearReleaseCache();
    globalThis.fetch = async () =>
      new Response("{}", { status: 503, statusText: "Unavailable" });
    await assert.rejects(() => inspectReleases("arc-node"), /HTTP 503/);
  } finally {
    globalThis.fetch = original;
    clearReleaseCache();
  }
});
