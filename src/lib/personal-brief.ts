import { dailyBrief } from "./daily-brief";
import { FollowStore } from "./follow-store";
import { selectFollowedBrief } from "./brief-selection";

export function personalBrief(owner: string) {
  const store = new FollowStore();
  try {
    return selectFollowedBrief(dailyBrief(), store.list(owner).map(f => f.projectId));
  } finally { store.close(); }
}
