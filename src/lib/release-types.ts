import type { RepositoryReport } from "./providers/repository";

export type ReleaseEvidence = {
  id: number; tag: string; name: string; publishedAt: string; prerelease: boolean;
  url: string; notes: string; notesTruncated: boolean;
};
export type ReleaseLookup = {
  sourceUrl: string; observedAt: string; status: "found" | "not-found" | "unavailable";
  release: ReleaseEvidence | null; error: string | null;
};
export type ReleaseInvestigation = {
  id: string; projectId: string; repository: string; tag: string; requireStable: boolean;
  question: string; createdAt: string; previousId: string | null; previousCommitment: string | null;
  lookup: ReleaseLookup; code: RepositoryReport | null; codeError: string | null;
  verdict: "supported" | "not-established" | "inconclusive";
  conclusion: string; limitations: string[]; commitment: string;
};
export function releaseComparison(previous: ReleaseInvestigation, current: ReleaseInvestigation) {
  if(current.previousId!==previous.id || current.previousCommitment!==previous.commitment ||
    current.projectId!==previous.projectId || current.tag!==previous.tag || current.requireStable!==previous.requireStable)
    throw new Error("Comparison must use the pinned investigation and the same release criterion.");
  const a=previous.lookup.release,b=current.lookup.release;
  return {
    previousId:previous.id,currentId:current.id,previousCommitment:previous.commitment,currentCommitment:current.commitment,
    verdictChanged:previous.verdict!==current.verdict,
    sourceChanged:previous.lookup.status!==current.lookup.status || JSON.stringify(a)!==JSON.stringify(b),
    headChanged:previous.code&&current.code?previous.code.commits[0]?.hash!==current.code.commits[0]?.hash:null,
    finding:previous.verdict!==current.verdict?"The release criterion has a different result. Inspect source status before treating this as a shipping change.":"The release criterion has the same result in both saved observations.",
    limitation:"A later observation is not a new release. Source errors are not removals, and publication is not network deployment.",
  };
}
