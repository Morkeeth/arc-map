import { getAddress, type Hex } from "viem";
import { MissionStore } from "@/lib/mission-store";
import {
  missionAccess,
  missionResponse,
  readMissionBody,
} from "@/lib/mission-access";
import {
  OPPORTUNITY_EVIDENCE_MAX_AGE_SECONDS,
  opportunityFixtureAddress,
  prepareOpportunityAction,
  simulateOpportunityAction,
  type OpportunityActionRequest,
  type OpportunitySimulationClient,
} from "@/lib/opportunity-action";
import { runOpportunityFixture } from "@/lib/opportunity-fixture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NegativeControl = "wrong-account" | "stale-evidence" | "changed-calldata";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (process.env.NEXT_PUBLIC_RESEARCH_PREVIEW === "1")
    return missionResponse(
      {
        error:
          "Public research preview is wallet-free and simulation-only; account-bound rehearsal is unavailable.",
      },
      undefined,
      403,
    );
  let access;
  try {
    access = missionAccess(request, true);
  } catch {
    return missionResponse({ error: "Access denied." }, undefined, 403);
  }
  try {
    const input = await readMissionBody(request);
    const account = getAddress(
      typeof input.account === "string" ? input.account : "",
    );
    const control = input.control as NegativeControl | undefined;
    if (
      control !== undefined &&
      !["wrong-account", "stale-evidence", "changed-calldata"].includes(control)
    )
      throw new Error("Unknown refusal control.");
    const { id } = await context.params;
    const store = new MissionStore();
    try {
      const mission = store.get(access.owner, id);
      if (!mission?.report || mission.status !== "reported")
        throw new Error("A completed Hunter report is required.");
      if (mission.report.stance !== "limited-support")
        throw new Error("The Hunter evidence does not support rehearsal.");
      const sourceBlock =
        mission.report.indexedBlock ??
        Math.max(0, ...mission.report.evidence.map((item) => item.block));
      const now = Math.floor(Date.now() / 1_000);
      const policyAccount = account;
      const requestData: OpportunityActionRequest = {
        account:
          control === "wrong-account"
            ? opportunityFixtureAddress("browser-wrong-account")
            : account,
        asset: opportunityFixtureAddress("opportunity-token"),
        target: getAddress(mission.address),
        amount: 25_000n,
        evidence: {
          reportId: mission.id,
          provider: mission.report.provider,
          source: mission.report.source,
          sourceBlock,
          observedAt:
            control === "stale-evidence"
              ? new Date(
                  (now - OPPORTUNITY_EVIDENCE_MAX_AGE_SECONDS - 1) * 1_000,
                ).toISOString()
              : mission.report.observedAt,
          counterevidence:
            mission.report.limitations[0] ??
            "A bounded sample does not establish target safety.",
        },
        policy: {
          chainId: 31_337,
          account: policyAccount,
          asset: opportunityFixtureAddress("opportunity-token"),
          reportContract: getAddress(mission.address),
          amountCeiling: 30_000n,
          expiresAt: now + 600,
        },
      };

      try {
        const prepared = prepareOpportunityAction(requestData, now);
        if (control === "changed-calldata") {
          const noRpcClient = new Proxy(
            {},
            {
              get() {
                return async () => {
                  throw new Error("Refusal reached simulation RPC.");
                };
              },
            },
          ) as OpportunitySimulationClient;
          await simulateOpportunityAction(noRpcClient, {
            ...prepared,
            calldata: "0x12345678" as Hex,
          });
          throw new Error("Changed calldata was not refused.");
        }
        const receipt = await runOpportunityFixture(prepared);
        const saved = store.saveOpportunityReceipt(access.owner, id, receipt);
        return missionResponse(
          { mission: saved, receipt },
          access.cookie,
        );
      } catch (error) {
        if (!control) throw error;
        return missionResponse(
          {
            refusal: {
              control,
              reason:
                error instanceof Error ? error.message : String(error),
              simulationRpcStarted: false,
            },
          },
          access.cookie,
          409,
        );
      }
    } finally {
      store.close();
    }
  } catch (error) {
    return missionResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Opportunity rehearsal could not run.",
      },
      access.cookie,
      400,
    );
  }
}
