export function assessIndexFreshness(input: {
  chainTimestamp: number; indexedTimestamp: number; chainBlock: number; indexedBlock: number; now: number;
}) {
  if (Object.values(input).some((v) => !Number.isSafeInteger(v) || v < 0))
    return { fresh: false, reason: "Invalid chain or index observation." };
  if (Math.abs(input.now - input.chainTimestamp) > 120)
    return { fresh: false, reason: "Arc RPC block is stale." };
  if (input.indexedBlock > input.chainBlock || input.indexedTimestamp > input.chainTimestamp)
    return { fresh: false, reason: "Index observation is ahead of the checked chain." };
  if (input.chainTimestamp - input.indexedTimestamp > 300)
    return { fresh: false, reason: "Graph is behind the checked chain. Research is historical; funding is paused." };
  return { fresh: true, reason: null };
}
