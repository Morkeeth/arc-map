import type { PolicyReview } from "./policy-envelope";
import type {
  MissionFundingReceipt,
  PreparedMissionTransaction,
} from "./funding-types";
import type { StoredOpportunityReceipt } from "./opportunity-action";

export const hunters = [
  {
    id: "distribution",
    name: "Distribution Hunter",
    code: "H01",
    mandate: "Separate token distribution from evidence of continued use.",
    description:
      "Investigates transfer concentration, distinct transactions and the observed time window. Tests a thesis instead of treating holder counts as adoption.",
    question:
      "Does the sampled transfer activity extend beyond a single distribution transaction?",
    falsifier:
      "A sample confined to one transaction does not support continued activity. A wider sample still cannot establish unique people or organic demand.",
    tools: [
      "query_transfer_subgraph",
      "inspect_transfer_sample",
      "prepare_mission_payment",
    ],
    execution:
      "Rules-based research runner. No autonomous trading or model-generated investment advice.",
  },
  {
    id: "activity", name: "Activity Hunter", code: "H02",
    mandate: "Inspect successful contract transactions without confusing calls with adoption.",
    description: "Reads a bounded sample of incoming contract transactions, their dates and distinct hashes.",
    question: "Does the returned sample contain successful transactions to this contract?",
    falsifier: "An empty sample cannot establish that no historical activity exists. Successful calls do not prove independent users or economic demand.",
    tools: ["inspect_contract_transactions", "commit_research_report"],
    execution: "Rules-based research runner. No autonomous trading or model-generated investment advice.",
  },
] as const;
export type EvidenceProvider = "graph" | "explorer";
export type MissionReport = {
  version: 1;
  hunter: string;
  thesis: string;
  conclusion: string;
  stance: "limited-support" | "not-supported" | "insufficient-evidence";
  provider: EvidenceProvider;
  source: string;
  observedAt: string;
  indexedBlock: number | null;
  sampleSize: number;
  transactions: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
  evidence: {
    transaction: string;
    block: number;
    from: string;
    to: string;
    timestamp: string | null;
    logIndex: number | null;
  }[];
  observations: string[];
  limitations: string[];
  steps: { tool: string; result: string }[];
};
export type Mission = {
  id: string;
  previousMissionId?: string;
  hunterId: string;
  projectId: string;
  address: string;
  thesis: string;
  thesisHash: `0x${string}`;
  provider: EvidenceProvider;
  createdAt: string;
  deadline: number;
  budget: string;
  fee: string;
  status: "created" | "researching" | "reported" | "blocked";
  report: MissionReport | null;
  reportHash: `0x${string}` | null;
  error: string | null;
  policyReview?: PolicyReview | null;
  opportunityReceipt?: StoredOpportunityReceipt | null;
  fundingIntent?: PreparedMissionTransaction | null;
  fundingReceipt?: MissionFundingReceipt | null;
};
