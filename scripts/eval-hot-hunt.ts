#!/usr/bin/env node
/**
 * One live Activity Hunter against a why-NOW hot lead from the local brief.
 * No wallet. Prints stance, sample/window and action proposal status.
 */
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { dailyBrief } = require("../src/lib/daily-brief.ts");
const { runHunter } = require("../src/lib/hunter-runner.ts");
const { actionProposalFor } = require("../src/lib/action-proposal.ts");
const { hunters } = require("../src/lib/hunters.ts");

async function main() {
  const brief = dailyBrief();
  const lead = brief.cards.find(
    (c: { kind: string; cooling: string; project: { contract?: string } }) =>
      c.kind === "activity" && c.cooling === "hot" && c.project.contract,
  );
  if (!lead) {
    console.log(JSON.stringify({ ok: false, error: "No hot activity lead in brief." }, null, 2));
    process.exitCode = 2;
    return;
  }
  const address = lead.project.contract as string;
  const hunter = hunters.find((h: { id: string }) => h.id === "activity");
  const thesis = hunter.question;
  const thesisHash = ("0x" +
    createHash("sha256").update(thesis).digest("hex")) as `0x${string}`;
  const mission = {
    id: randomUUID(),
    hunterId: "activity" as const,
    projectId: lead.project.id,
    address,
    thesis,
    thesisHash,
    provider: "explorer" as const,
    createdAt: new Date().toISOString(),
    deadline: Math.floor(Date.now() / 1000) + 86400,
    budget: "0.05",
    fee: "0.01",
    status: "researching" as const,
    report: null,
    reportHash: null,
    error: null,
  };
  const report = await runHunter(mission);
  const proposal = actionProposalFor(report, address);
  console.log(
    JSON.stringify(
      {
        ok: true,
        lead: {
          name: lead.project.name,
          contract: address,
          cooling: lead.cooling,
          whyNow: lead.whyNow,
          counterevidence: lead.counterevidence,
          observations: lead.observations,
          signalAt: lead.signalAt,
          firstEventAt: lead.firstEventAt,
          lastEventAt: lead.lastEventAt,
        },
        report: {
          stance: report.stance,
          conclusion: report.conclusion,
          sampleSize: report.sampleSize,
          transactions: report.transactions,
          firstEventAt: report.firstEventAt,
          lastEventAt: report.lastEventAt,
          provider: report.provider,
          source: report.source,
        },
        proposal: {
          status: proposal.status,
          title: proposal.title,
          summary: proposal.summary,
          checklist: proposal.checklist.map((s: { id: string; label: string }) => ({
            id: s.id,
            label: s.label,
          })),
          id: proposal.id,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
