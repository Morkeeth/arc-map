import test from "node:test";
import assert from "node:assert/strict";
import { MissionStore } from "../src/lib/mission-store";
test("research rate limit fires across missions and permits a later retry", () => {
  const store = new MissionStore(":memory:");
  try {
    for (let i = 0; i < 5; i++) {
      const m = store.create("owner", {
        projectId: "sun-token",
        provider: "graph",
        budget: "0.05",
      });
      store.claim("owner", m.id, 100000);
      store.finish("owner", m.id, null, "test provider outage");
    }
    const next = store.create("owner", {
      projectId: "sun-token",
      provider: "graph",
      budget: "0.05",
    });
    assert.throws(() => store.claim("owner", next.id, 100001), /rate limit/);
    assert.equal(store.claim("owner", next.id, 160001).status, "researching");
  } finally {
    store.close();
  }
});
