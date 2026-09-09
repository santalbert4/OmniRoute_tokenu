import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryWorkspacePlanRepository } from "@/tokenu/runtime/inMemoryWorkspacePlanRepository";

test("workspace plan repository stores plans by plan id", async () => {
  const repository = new InMemoryWorkspacePlanRepository();

  await repository.save({
    id: "pro",
    tier: "pro",
    monthlyCostLimit: 50,
    monthlyRequestLimit: 10000,
    currency: "USD",
  });

  const plan = await repository.get("pro");

  assert.equal(plan?.id, "pro");

  assert.equal(plan?.tier, "pro");

  assert.equal(plan?.monthlyCostLimit, 50);
});

test("workspace plan repository updates an existing plan definition", async () => {
  const repository = new InMemoryWorkspacePlanRepository();

  await repository.save({
    id: "pro",
    tier: "pro",
    monthlyCostLimit: 50,
    monthlyRequestLimit: 10000,
    currency: "USD",
  });

  await repository.save({
    id: "pro",
    tier: "pro",
    monthlyCostLimit: 75,
    monthlyRequestLimit: 20000,
    currency: "USD",
  });

  const plan = await repository.get("pro");

  assert.equal(plan?.monthlyCostLimit, 75);

  assert.equal(plan?.monthlyRequestLimit, 20000);
});
