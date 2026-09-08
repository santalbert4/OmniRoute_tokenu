import assert from "node:assert/strict";
import test from "node:test";

import { WorkspacePlanResolverService } from "@/tokenu/runtime/workspacePlanResolverService";
import { InMemoryWorkspacePlanRepository } from "@/tokenu/runtime/inMemoryWorkspacePlanRepository";

test("workspace plan resolver returns workspace plan", async () => {
  const repository = new InMemoryWorkspacePlanRepository();

  await repository.save("workspace-1", {
    id: "starter",
    tier: "starter",
    monthlyCostLimit: 10,
    monthlyRequestLimit: 1000,
    currency: "USD",
  });

  const service = new WorkspacePlanResolverService(repository);

  const plan = await service.resolve("workspace-1");

  assert.equal(plan?.tier, "starter");

  assert.equal(plan?.monthlyRequestLimit, 1000);
});

test("workspace plan resolver returns null when missing", async () => {
  const service = new WorkspacePlanResolverService(new InMemoryWorkspacePlanRepository());

  const plan = await service.resolve("unknown");

  assert.equal(plan, null);
});
