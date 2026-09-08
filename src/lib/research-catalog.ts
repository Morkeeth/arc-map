import { projects, graphCovers, type Project } from "./projects";
import { RadarStore } from "./radar-store";
import type { RadarRecord } from "./radar-types";
export function radarProject(record: RadarRecord): Project {
  return {
    id: record.id, name: record.name, symbol: record.symbol || record.name.replace(/[^a-zA-Z]/g, "").slice(0,3).toUpperCase() || "?", category: record.kind === "token" ? "Observed token" : "Observed contract",
    summary: record.kind === "token" ? "Token listing observed on Arc testnet." : "Contract observed in Arcscan source data.",
    question: "What does the source evidence support?",
    context: "First observed is not a launch date. A source-code verification is not an audit, official association or proof of adoption.",
    website: `https://testnet.arcscan.app/address/${record.address}`,
    reference: `https://testnet.arcscan.app/address/${record.address}`,
    relation: "Discovered through Arcscan. Names and metadata are untrusted; no website, team, repository or official affiliation is inferred.",
    contract: record.address,
    researchKind: record.kind,
  };
}
export function researchProject(id: unknown): Project | undefined {
  const curated = projects.find(p => p.id === id);
  if (curated) return curated;
  if (typeof id !== "string" || !/^arc:0x[0-9a-f]{40}$/.test(id)) return;
  const store = new RadarStore();
  try { const found = store.get(id); return found ? radarProject(found) : undefined; }
  finally { store.close(); }
}
export { graphCovers };
