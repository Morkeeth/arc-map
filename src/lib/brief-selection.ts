import { projects, type Project } from "./projects";
import type { DailyBrief } from "./daily-brief";

// Only an exact, sourced address can alias a curated ID. Names never establish identity.
export function projectIdentity(id: string): string {
  const curated = projects.find(p => p.id === id);
  if (curated?.contract) return `arc:${curated.contract.toLowerCase()}`;
  return /^arc:0x[0-9a-fA-F]{40}$/.test(id) ? id.toLowerCase() : id;
}

export function isFollowed(project: Project, ids: string[]): boolean {
  return ids.some(id => projectIdentity(id) === projectIdentity(project.id));
}

export function selectFollowedBrief(brief: DailyBrief, ids: string[]): DailyBrief {
  return {
    ...brief,
    cards: brief.cards.filter(card => isFollowed(card.project, ids)),
    coverage: `Only projects currently followed in this workspace. Includes retained observations from before you followed; this is not the unread Changes view. ${brief.coverage}`,
  };
}
