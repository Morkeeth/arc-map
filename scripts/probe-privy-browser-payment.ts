#!/usr/bin/env npx tsx
/**
 * Privy browser payment probe — stops at the first concrete missing step.
 * CLI testnet lifecycle is intentionally NOT accepted as browser verification.
 *
 *   npx tsx scripts/probe-privy-browser-payment.ts
 */
import { chainConfig } from "../src/lib/mission-chain";
import { PRIVY_APP_ID } from "../src/lib/app-config";

type Step = {
  step: string;
  status: "PASS" | "BLOCKED" | "SKIP";
  detail: string;
};

async function main() {
  const steps: Step[] = [];
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3107";

  steps.push({
    step: "1.public-privy-app-id",
    status: PRIVY_APP_ID ? "PASS" : "BLOCKED",
    detail: PRIVY_APP_ID
      ? `NEXT_PUBLIC_PRIVY_APP_ID/fallback present (${PRIVY_APP_ID.slice(0, 8)}…)`
      : "Privy app id missing",
  });

  const escrow = chainConfig();
  steps.push({
    step: "2.escrow-env",
    status: escrow.configured ? "PASS" : "BLOCKED",
    detail: escrow.configured
      ? `escrow configured at ${escrow.address}`
      : escrow.reason || "escrow env incomplete",
  });

  // Browser login cannot be completed without Oscar's interactive Privy session.
  const hasInteractivePrivy =
    process.env.ARCMAP_PRIVY_BROWSER_SESSION === "authorized";
  steps.push({
    step: "3.interactive-privy-login",
    status: hasInteractivePrivy ? "PASS" : "BLOCKED",
    detail: hasInteractivePrivy
      ? "ARCMAP_PRIVY_BROWSER_SESSION=authorized set by operator"
      : "No interactive Privy login/signature in this agent environment. Wallet connect UI exists; no authenticated browser session was supplied.",
  });

  steps.push({
    step: "4.browser-fund-settle-refund",
    status: "SKIP",
    detail:
      "Not attempted. Depends on steps 2–3. CLI `scripts/arc-testnet-release.ts --lifecycle` is a different path and is not counted here.",
  });

  // Soft check: app origin must match Privy allowlist for real browser auth.
  const publicOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  steps.push({
    step: "5.privy-allowed-origin",
    status: publicOrigin && publicOrigin.startsWith("https:")
      ? "PASS"
      : "BLOCKED",
    detail: publicOrigin
      ? `NEXT_PUBLIC_APP_ORIGIN=${publicOrigin} (Privy dashboard must allow this exact origin)`
      : `Defaulting to ${origin}. Public HTTPS origin not set; Privy browser auth for a hosted beta is blocked.`,
  });

  const firstBlock = steps.find((s) => s.status === "BLOCKED");
  console.log(
    JSON.stringify(
      {
        browserPaymentVerified: false,
        firstBlockedStep: firstBlock?.step || null,
        firstBlockedDetail: firstBlock?.detail || null,
        steps,
        explicitNonClaim:
          "Operator CLI Arc testnet lifecycle is verified elsewhere and does not satisfy this probe.",
      },
      null,
      2,
    ),
  );
  process.exit(firstBlock ? 2 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
