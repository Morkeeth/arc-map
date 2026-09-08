import { MissionStore } from "@/lib/mission-store";
import {
  missionAccess,
  missionResponse,
  readMissionBody,
} from "@/lib/mission-access";
import { missionChainState, prepareMissionAction } from "@/lib/mission-chain";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if(process.env.NEXT_PUBLIC_RESEARCH_PREVIEW === "1") return missionResponse({error:"Wallet actions are unavailable in this research preview."},undefined,403);
  try {
    const access = missionAccess(request);
    const { id } = await context.params;
    const store = new MissionStore();
    try {
      const mission = store.get(access.owner, id);
      if (!mission)
        return missionResponse(
          { error: "Mission not found." },
          access.cookie,
          404,
        );
      return missionResponse(
        { chain: await missionChainState(mission) },
        access.cookie,
      );
    } finally {
      store.close();
    }
  } catch {
    return missionResponse(
      {
        error:
          "Onchain state could not be verified. No funding or payment is assumed.",
      },
      undefined,
      503,
    );
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if(process.env.NEXT_PUBLIC_RESEARCH_PREVIEW === "1") return missionResponse({error:"Wallet actions are unavailable in this research preview."},undefined,403);
  let access;
  try {
    access = missionAccess(request, true);
  } catch {
    return missionResponse({ error: "Access denied." }, undefined, 403);
  }
  const store = new MissionStore();
  try {
    const { id } = await context.params;
    const mission = store.get(access.owner, id);
    if (!mission)
      return missionResponse(
        { error: "Mission not found." },
        access.cookie,
        404,
      );
    const body = await readMissionBody(request);
    const transaction = await prepareMissionAction(
      mission,
      body.action,
      body.account,
    );
    const saved =
      transaction.action === "fund"
        ? store.saveFundingIntent(access.owner, id, transaction)
        : mission;
    return missionResponse(
      {
        mission: saved,
        transaction:
          transaction.action === "fund"
            ? saved.fundingIntent
            : transaction,
      },
      access.cookie,
    );
  } catch (error) {
    return missionResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Transaction preparation failed. No transaction was sent.",
      },
      access.cookie,
      409,
    );
  } finally {
    store.close();
  }
}
