import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { actionProposalFor } from "../src/lib/action-proposal";
import { initialPolicyEnvelope } from "../src/lib/policy-envelope";
import type { Mission } from "../src/lib/hunters";

const origin = "http://localhost:3107";
const statePath = resolve(".data/policy-revisit-proof.json");
const phase = process.argv[2];

type ProofState = {
  token: string;
  missionId: string;
  receiptId: string;
  leadId: string;
  projectId: string;
  target: string;
};

async function call(
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; data: any }> {
  const response = await fetch(`${origin}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      Cookie: `arcmap_session=${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

async function prepare() {
  const token = randomBytes(32).toString("hex");
  const brief = await call("/api/brief", token);
  assert.equal(brief.status, 200);
  const lead = brief.data.cards.find(
    (card: any) =>
      card.kind === "activity" &&
      card.project?.contract &&
      card.evidence?.length &&
      card.whyNow &&
      card.counterevidence,
  );
  assert.ok(lead, "A retained activity lead with Why NOW is required.");

  const created = await call("/api/missions", token, {
    projectId: lead.project.id,
    provider: "explorer",
    budget: "0.05",
  });
  assert.equal(created.status, 201);
  const run = await call(
    `/api/missions/${created.data.mission.id}/run`,
    token,
    {},
  );
  assert.equal(run.status, 200);
  const mission = run.data.mission as Mission;
  assert.equal(mission.address.toLowerCase(), lead.project.contract.toLowerCase());
  assert.equal(mission.report?.stance, "limited-support");
  assert.ok(mission.report.evidence.length > 0);
  assert.ok(mission.report.limitations.length > 0);

  const proposal = actionProposalFor(mission.report, mission.address);
  const envelope = {
    ...initialPolicyEnvelope(proposal),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    counterevidenceRef: `${lead.counterevidence} Report limit: ${mission.report.limitations[0]}`,
  };
  const negative = await call(
    `/api/missions/${mission.id}/policy`,
    token,
    {
      envelope: { ...envelope, counterevidenceRef: "" },
      proposedAmount: "0.01",
    },
  );
  assert.equal(negative.status, 200);
  assert.equal(
    negative.data.policyReview.receipt.stopReason.field,
    "counterevidence",
  );

  const positive = await call(
    `/api/missions/${mission.id}/policy`,
    token,
    { envelope, proposedAmount: "0.01" },
  );
  assert.equal(positive.status, 200);
  assert.equal(positive.data.policyReview.receipt.status, "simulated");
  assert.equal(positive.data.policyReview.receipt.action.target, mission.address);

  const state: ProofState = {
    token,
    missionId: mission.id,
    receiptId: positive.data.policyReview.receipt.id,
    leadId: lead.id,
    projectId: lead.project.id,
    target: mission.address,
  };
  mkdirSync(resolve(".data"), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
  console.log(
    JSON.stringify({
      phase: "prepare",
      lead: {
        id: state.leadId,
        projectId: state.projectId,
        target: state.target,
        whyNow: lead.whyNow,
        retainedCounterevidence: lead.counterevidence,
      },
      missionId: state.missionId,
      report: {
        stance: mission.report.stance,
        evidence: mission.report.evidence.length,
        limitations: mission.report.limitations.length,
      },
      negativeStop: "counterevidence",
      savedReceipt: state.receiptId,
      execution: "none",
    }),
  );
}

async function revisit() {
  const state = JSON.parse(readFileSync(statePath, "utf8")) as ProofState;
  const mission = await call(`/api/missions/${state.missionId}`, state.token);
  assert.equal(mission.status, 200);
  assert.equal(mission.data.mission.policyReview.receipt.id, state.receiptId);
  assert.equal(mission.data.mission.policyReview.receipt.status, "simulated");
  assert.equal(
    mission.data.mission.policyReview.receipt.action.target.toLowerCase(),
    state.target.toLowerCase(),
  );
  assert.ok(mission.data.mission.report.evidence.length > 0);
  assert.ok(mission.data.mission.report.limitations.length > 0);

  const brief = await call("/api/brief", state.token);
  assert.equal(brief.status, 200);
  assert.ok(
    brief.data.cards.some((card: any) => card.id === state.leadId),
    "The originating discovery lead should remain retained for this revisit.",
  );
  console.log(
    JSON.stringify({
      phase: "revisit-after-process-restart",
      leadId: state.leadId,
      missionId: state.missionId,
      receiptId: state.receiptId,
      receiptStatus: mission.data.mission.policyReview.receipt.status,
      evidenceRows: mission.data.mission.report.evidence.length,
      limitations: mission.data.mission.report.limitations.length,
      sameCookieWorkspace: true,
      execution: "none",
    }),
  );
}

if (phase === "prepare") await prepare();
else if (phase === "revisit") await revisit();
else throw new Error("Use prepare or revisit.");
