import { ADDRESS, asCount } from "./analysis";
import { RadarStore } from "./radar-store";
import type { RadarObservation } from "./radar-types";
const origin = "https://testnet.arcscan.app";
export const RADAR_SOURCES = [
  { id: "token-list", path: "/api/v2/tokens?type=ERC-20" },
  { id: "verification", path: "/api/v2/smart-contracts" },
  { id: "transaction", path: "/api/v2/transactions?filter=validated" },
] as const;
function timestamp(input: unknown, now: string) {
  if (typeof input !== "string" || !Number.isFinite(Date.parse(input)) || Date.parse(input) > Date.parse(now) + 60000) return null;
  return new Date(input).toISOString();
}
export function parseRadar(source: RadarObservation["source"], data: unknown, observedAt: string): RadarObservation[] {
  const payload = data as { items?: Record<string, any>[] };
  if (!Array.isArray(payload?.items)) throw new Error("Unexpected radar source response");
  return payload.items.slice(0, 50).flatMap((item) => {
    const node = source === "token-list" ? item : source === "verification" ? item.address : item.created_contract || item.to;
    const address = source === "token-list" ? node?.address_hash : node?.hash;
    if (typeof address !== "string" || !ADDRESS.test(address)) return [];
    if (source === "transaction" && (node?.is_contract !== true || item.status !== "ok")) return [];
    const eventAt = source === "verification" ? timestamp(item.verified_at, observedAt) : source === "transaction" ? timestamp(item.timestamp, observedAt) : null;
    if (source !== "token-list" && !eventAt) return [];
    const hash = typeof item.hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(item.hash) ? item.hash : null;
    if (source === "transaction" && !hash) return [];
    const name = typeof node.name === "string" && node.name.trim() ? node.name.trim().slice(0, 100) : "Unnamed contract";
    return [{
      address: address.toLowerCase(), name,
      symbol: source === "token-list" && typeof item.symbol === "string" ? item.symbol.slice(0, 30) : null,
      kind: source === "token-list" ? "token" as const : "contract" as const,
      source, sourceUrl: source === "transaction" ? `${origin}/tx/${hash}` : `${origin}/${source === "token-list" ? "token" : "address"}/${address}`,
      observedAt, eventAt, eventId: source === "transaction" ? hash : eventAt,
      holders: source === "token-list" ? asCount(item.holders_count) : null,
      sourceCodeVerified: source === "token-list" ? null : typeof node.is_verified === "boolean" ? node.is_verified : null,
    }];
  });
}
async function get(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000), redirect: "error", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Radar source returned HTTP ${response.status}`);
  return response.json();
}
export async function ingestRadar(store: RadarStore, fetchJson = get) {
  if (!store.acquire()) return { checked: 0, inserted: 0, skipped: true };
  let inserted = 0;
  await Promise.all(RADAR_SOURCES.map(async source => {
    const at = new Date().toISOString();
    try {
      const rows = parseRadar(source.id, await fetchJson(origin + source.path), at);
      // Stable oldest-first handling preserves the earliest event within each bounded page.
      rows.sort((a, b) => (a.eventAt || "").localeCompare(b.eventAt || ""));
      for (const row of rows) if (store.record(row)) inserted++;
      store.markSource(source.id, at, null);
    } catch { store.markSource(source.id, at, "Source unavailable or invalid. Previous observations retained."); }
  }));
  return { checked: RADAR_SOURCES.length, inserted, skipped: false };
}
