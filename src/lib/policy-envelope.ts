import type { ActionProposal } from "./action-proposal";
import { stableId } from "./stable-id";

export const SIMULATED_ASSET = "Arc testnet native USDC (simulation only)";
export const MAX_SIMULATED_CEILING = 10;

export type PolicyField =
  | "ceiling"
  | "asset"
  | "target"
  | "evidenceThreshold"
  | "expiry"
  | "counterevidence";

export type PolicyEnvelope = {
  version: 1;
  ceiling: string;
  approvedAsset: string;
  approvedTarget: string;
  evidenceThreshold: number;
  expiresAt: string;
  counterevidenceRef: string;
};

export type SimulatedAction = {
  kind: "review-only-allocation";
  amount: string;
  asset: string;
  target: string;
};

export type PolicyReceipt = {
  id: string;
  status: "simulated" | "withheld";
  simulatedAt: string;
  envelope: PolicyEnvelope | null;
  action: SimulatedAction | null;
  evidence: {
    stance: ActionProposal["basedOn"]["stance"];
    observedTransactions: number;
    source: string;
    observedAt: string;
  };
  stopReason: {
    field: PolicyField;
    message: string;
  } | null;
  limit: "Review artifact only. No signing, approval, transfer, swap, bridge or broadcast occurred.";
};

export type PolicyReview = {
  envelope: PolicyEnvelope;
  proposedAmount: string;
  receipt: PolicyReceipt;
};

export function initialPolicyEnvelope(
  proposal: ActionProposal,
): PolicyEnvelope {
  const expiresAt = new Date(
    new Date(proposal.basedOn.observedAt).getTime() + 24 * 60 * 60 * 1000,
  ).toISOString();
  return {
    version: 1,
    ceiling: "0.05",
    approvedAsset: SIMULATED_ASSET,
    approvedTarget: proposal.basedOn.target ?? "",
    evidenceThreshold: 2,
    expiresAt,
    counterevidenceRef:
      proposal.basedOn.limitations[0] ??
      "Hunter report limitations and retained source transactions",
  };
}

export function evaluatePolicyEnvelope({
  proposal,
  envelope,
  proposedAmount,
  now,
}: {
  proposal: ActionProposal;
  envelope: PolicyEnvelope;
  proposedAmount: string;
  now: string;
}): PolicyReceipt {
  const action: SimulatedAction = {
    kind: "review-only-allocation",
    amount: proposedAmount,
    asset: envelope.approvedAsset,
    target: envelope.approvedTarget,
  };
  const stop = validate(proposal, envelope, action, now);
  return receipt(
    proposal,
    now,
    envelope,
    stop ? null : action,
    stop,
  );
}

export function policyReviewFromInput({
  proposal,
  input,
  now,
}: {
  proposal: ActionProposal;
  input: Record<string, unknown>;
  now: string;
}): PolicyReview {
  const raw =
    input.envelope &&
    typeof input.envelope === "object" &&
    !Array.isArray(input.envelope)
      ? (input.envelope as Record<string, unknown>)
      : {};
  const envelope: PolicyEnvelope = {
    version: 1,
    ceiling: typeof raw.ceiling === "string" ? raw.ceiling : "",
    approvedAsset:
      typeof raw.approvedAsset === "string" ? raw.approvedAsset : "",
    approvedTarget:
      typeof raw.approvedTarget === "string" ? raw.approvedTarget : "",
    evidenceThreshold:
      typeof raw.evidenceThreshold === "number"
        ? raw.evidenceThreshold
        : Number.NaN,
    expiresAt: typeof raw.expiresAt === "string" ? raw.expiresAt : "",
    counterevidenceRef:
      typeof raw.counterevidenceRef === "string"
        ? raw.counterevidenceRef
        : "",
  };
  const proposedAmount =
    typeof input.proposedAmount === "string" ? input.proposedAmount : "";
  return {
    envelope,
    proposedAmount,
    receipt: evaluatePolicyEnvelope({
      proposal,
      envelope,
      proposedAmount,
      now,
    }),
  };
}

export function evidenceWithholdReceipt(
  proposal: ActionProposal,
  now: string,
): PolicyReceipt {
  const message =
    proposal.basedOn.stance === "not-supported"
      ? "The Hunter sample did not support the thesis, so the evidence threshold cannot pass."
      : "The Hunter returned insufficient evidence, so the evidence threshold cannot be evaluated.";
  return receipt(proposal, now, null, null, {
    field: "evidenceThreshold",
    message,
  });
}

function validate(
  proposal: ActionProposal,
  envelope: PolicyEnvelope,
  action: SimulatedAction,
  now: string,
): PolicyReceipt["stopReason"] {
  if (proposal.basedOn.stance !== "limited-support") {
    return {
      field: "evidenceThreshold",
      message: "A supported Hunter result is required before simulation.",
    };
  }

  const ceiling = Number(envelope.ceiling);
  if (
    !Number.isFinite(ceiling) ||
    ceiling <= 0 ||
    ceiling > MAX_SIMULATED_CEILING
  ) {
    return {
      field: "ceiling",
      message: `Ceiling must be greater than 0 and no more than ${MAX_SIMULATED_CEILING}.`,
    };
  }
  if (envelope.approvedAsset !== SIMULATED_ASSET) {
    return {
      field: "asset",
      message: `Approved asset must remain “${SIMULATED_ASSET}”.`,
    };
  }
  if (
    !/^0x[0-9a-fA-F]{40}$/.test(envelope.approvedTarget) ||
    envelope.approvedTarget.toLowerCase() !==
      proposal.basedOn.target?.toLowerCase()
  ) {
    return {
      field: "target",
      message: "Approved target must be the contract bound to this Hunter report.",
    };
  }
  if (
    !Number.isSafeInteger(envelope.evidenceThreshold) ||
    envelope.evidenceThreshold < 1 ||
    proposal.basedOn.transactions < envelope.evidenceThreshold
  ) {
    return {
      field: "evidenceThreshold",
      message: `Observed ${proposal.basedOn.transactions} distinct transactions; policy requires ${envelope.evidenceThreshold}.`,
    };
  }
  const expiresAt = Date.parse(envelope.expiresAt);
  const simulatedAt = Date.parse(now);
  if (
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(simulatedAt) ||
    simulatedAt > expiresAt
  ) {
    return {
      field: "expiry",
      message: "Policy expiry is invalid or has passed.",
    };
  }
  if (!envelope.counterevidenceRef.trim()) {
    return {
      field: "counterevidence",
      message: "A counterevidence reference is required before simulation.",
    };
  }
  const amount = Number(action.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > ceiling) {
    return {
      field: "ceiling",
      message: `Proposed amount must be greater than 0 and within the ${envelope.ceiling} ceiling.`,
    };
  }
  return null;
}

function receipt(
  proposal: ActionProposal,
  simulatedAt: string,
  envelope: PolicyEnvelope | null,
  action: SimulatedAction | null,
  stopReason: PolicyReceipt["stopReason"],
): PolicyReceipt {
  const seed = JSON.stringify([
    proposal.id,
    simulatedAt,
    envelope,
    action,
    stopReason,
  ]);
  return {
    id: `sim-${stableId(seed, 1)}`,
    status: stopReason ? "withheld" : "simulated",
    simulatedAt,
    envelope,
    action,
    evidence: {
      stance: proposal.basedOn.stance,
      observedTransactions: proposal.basedOn.transactions,
      source: proposal.basedOn.source,
      observedAt: proposal.basedOn.observedAt,
    },
    stopReason,
    limit:
      "Review artifact only. No signing, approval, transfer, swap, bridge or broadcast occurred.",
  };
}
