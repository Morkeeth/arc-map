import { isHex, type Hex } from "viem";
import { MissionStore } from "@/lib/mission-store";
import {
  missionAccess,
  missionResponse,
  readMissionBody,
} from "@/lib/mission-access";
import {
  missionChainState,
  verifyMissionFundingReceipt,
} from "@/lib/mission-chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (process.env.NEXT_PUBLIC_RESEARCH_PREVIEW === "1")
    return missionResponse(
      { error: "Wallet actions are unavailable in this research preview." },
      undefined,
      403,
    );
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
    if (!mission?.fundingIntent?.policy)
      return missionResponse(
        { error: "No prepared funding request exists for this mission." },
        access.cookie,
        409,
      );
    const body = await readMissionBody(request);
    const transactionHash = body.transactionHash;
    const bindingHash = body.bindingHash;
    if (
      typeof transactionHash !== "string" ||
      !isHex(transactionHash) ||
      transactionHash.length !== 66
    )
      throw new Error("A complete transaction hash is required.");
    if (
      bindingHash !== mission.fundingIntent.policy.bindingHash
    )
      throw new Error("Funding verification does not match the prepared policy.");
    const receipt = await verifyMissionFundingReceipt(
      mission,
      mission.fundingIntent,
      transactionHash as Hex,
    );
    const saved = store.saveFundingReceipt(access.owner, id, receipt);
    return missionResponse(
      {
        mission: saved,
        fundingReceipt: receipt,
        chain: await missionChainState(saved),
      },
      access.cookie,
    );
  } catch (error) {
    return missionResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Funding receipt could not be verified. Mission remains inactive.",
      },
      access.cookie,
      409,
    );
  } finally {
    store.close();
  }
}
