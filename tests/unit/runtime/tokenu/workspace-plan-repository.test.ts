import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryWorkspacePlanRepository } from "@/tokenu/runtime/inMemoryWorkspacePlanRepository";

test("workspace plan repository stores plans", async () => {
  const repository = new InMemoryWorkspacePlanRepository();

  await repository.save("workspace-1", {
    id: "pro",
    tier: "pro",
    monthlyCostLimit: 50,
    monthlyRequestLimit: 10000,
    currency: "USD",
  });

  const plan = await repository.get("workspace-1");

  assert.equal(plan?.tier, "pro");

  assert.equal(plan?.monthlyCostLimit, 50);
});
