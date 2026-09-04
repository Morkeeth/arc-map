export type Observation = {
  projectId: string;
  sourceId: string;
  kind: "code" | "onchain";
  sourceUrl: string;
  observedAt: string;
  eventAt: string | null;
  payload: {
    commit?: string;
    message?: string;
    holders?: number | null;
    transfers?: number | null;
  };
};
export type FeedEvent = {
  id: string;
  projectId: string;
  kind: "code" | "onchain" | "baseline";
  title: string;
  detail: string;
  sourceUrl: string;
  observedAt: string;
  eventAt: string | null;
  baselineAt: string | null;
};
export type SourceHealth = {
  sourceId: string;
  lastAttempt: string;
  lastSuccess: string | null;
  error: string | null;
};
export type FeedData = {
  events: FeedEvent[];
  sources: SourceHealth[];
  generatedAt: string;
  coverage: string;
};
