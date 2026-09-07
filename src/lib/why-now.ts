/**
 * Why-NOW clocks are derived from original source/activity timestamps on each lead.
 * Observation/retrieval time is never treated as an on-chain event time.
 * Cooling labels are age bands over those clocks — not holder counts, volume or names.
 */

export type Cooling = "hot" | "warm" | "cooling" | "cold" | "unknown";

export type WhyNowClock = {
  signalAt: string | null;
  signalAgeMs: number | null;
  eventWindowMs: number | null;
  cooling: Cooling;
  whyNow: string;
};

/** Age bands for investigation urgency. Tuned to the 24h brief window, not volume. */
export const COOLING_BANDS_MS = {
  hot: 60 * 60 * 1000,
  warm: 6 * 60 * 60 * 1000,
  cooling: 24 * 60 * 60 * 1000,
} as const;

export function coolingFromAgeMs(ageMs: number | null): Cooling {
  if (ageMs === null || !Number.isFinite(ageMs) || ageMs < 0) return "unknown";
  if (ageMs < COOLING_BANDS_MS.hot) return "hot";
  if (ageMs < COOLING_BANDS_MS.warm) return "warm";
  if (ageMs < COOLING_BANDS_MS.cooling) return "cooling";
  return "cold";
}

export function coolingRank(cooling: Cooling): number {
  if (cooling === "hot") return 0;
  if (cooling === "warm") return 1;
  if (cooling === "cooling") return 2;
  if (cooling === "cold") return 3;
  return 4;
}

function parseAt(value: string | null | undefined, now: number): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  if (!Number.isFinite(t) || t > now) return null;
  return t;
}

export function deriveWhyNow(input: {
  now?: number;
  observedAt: string;
  firstEventAt: string | null;
  lastEventAt: string | null;
  kind: string;
}): WhyNowClock {
  const now = input.now ?? Date.now();
  const first = parseAt(input.firstEventAt, now);
  const last = parseAt(input.lastEventAt, now);
  const signalMs = last ?? first;
  const signalAt = signalMs === null ? null : new Date(signalMs).toISOString();
  const signalAgeMs = signalMs === null ? null : now - signalMs;
  const eventWindowMs =
    first !== null && last !== null && last >= first ? last - first : null;
  const cooling = coolingFromAgeMs(signalAgeMs);

  let whyNow: string;
  if (cooling === "unknown") {
    whyNow =
      "No original source-event clock is available. The observation time alone cannot establish urgency — treat this as context, not a cooling signal.";
  } else if (cooling === "hot") {
    whyNow = `Source events are still within the last hour (signal age ${formatAge(signalAgeMs!)}). Investigate before this window goes cold; retrieval time is not the event time.`;
  } else if (cooling === "warm") {
    whyNow = `Source events are within six hours (signal age ${formatAge(signalAgeMs!)}). Still worth a Hunter check while the trail is recent.`;
  } else if (cooling === "cooling") {
    whyNow = `Source events are within 24 hours but no longer hot (signal age ${formatAge(signalAgeMs!)}). A thesis check still makes sense; do not confuse observation freshness with event freshness.`;
  } else {
    whyNow = `The latest sourced event is older than a day (signal age ${formatAge(signalAgeMs!)}). Useful as backlog context, not as a “move now” signal.`;
  }

  if (eventWindowMs !== null && eventWindowMs > 0) {
    whyNow += ` Sampled event span: ${formatAge(eventWindowMs)}.`;
  } else if (signalAt && input.kind === "activity") {
    whyNow += " Only a single sourced event timestamp is retained in this lead.";
  }

  return { signalAt, signalAgeMs, eventWindowMs, cooling, whyNow };
}

function formatAge(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}
