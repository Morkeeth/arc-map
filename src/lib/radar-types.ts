import type { Project } from "./projects";
export type RadarObservation = {
  address: string; name: string; symbol: string | null; kind: "token" | "contract";
  source: "token-list" | "verification" | "transaction";
  sourceUrl: string; observedAt: string; eventAt: string | null; eventId: string | null;
  holders: number | null; sourceCodeVerified: boolean | null;
};
export type RadarRecord = {
  id: string; address: string; name: string; symbol: string | null; kind: "token" | "contract";
  firstObservedAt: string; lastObservedAt: string; verifiedAt: string | null; lastActivityAt: string | null;
  holders: number | null; sourceCodeVerified: boolean | null; sources: string[];
};
export type RadarEvent = RadarObservation & { id: string; title: string };
export type RadarData = {
  records: RadarRecord[]; events: RadarEvent[]; projects: Project[];
  sources: { id: string; lastAttempt: string; lastSuccess: string | null; error: string | null }[];
  coverage: string; generatedAt: string;
};
