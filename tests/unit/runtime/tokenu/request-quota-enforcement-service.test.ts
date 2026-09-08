import assert from "node:assert/strict";
import test from "node:test";

import { RequestQuotaEnforcementService } from "@/tokenu/runtime/requestQuotaEnforcementService";
import { InMemoryWorkspaceRequestUsageRepository } from "@/tokenu/runtime/inMemoryWorkspaceRequestUsageRepository";

test("request quota allows workspace below request limit", async () => {
  const repository = new InMemoryWorkspaceRequestUsageRepository();

  await repository.increment("workspace-1", "2026-09");

  const service = new RequestQuotaEnforcementService(repository);

  const result = await service.enforce("workspace-1", "2026-09", {
    id: "starter",
    tier: "starter",
    monthlyCostLimit: 10,
    monthlyRequestLimit: 1000,
    currency: "USD",
  });

  assert.equal(result.allowed, true);

  assert.equal(result.remainingRequests, 999);
});

test("request quota blocks workspace exceeding request limit", async () => {
  const repository = new InMemoryWorkspaceRequestUsageRepository();

  for (let index = 0; index < 2; index += 1) {
    await repository.increment("workspace-1", "2026-09");
  }

  const service = new RequestQuotaEnforcementService(repository);

  const result = await service.enforce("workspace-1", "2026-09", {
    id: "starter",
    tier: "starter",
    monthlyCostLimit: 10,
    monthlyRequestLimit: 2,
    currency: "USD",
  });

  assert.equal(result.allowed, false);

  assert.equal(result.remainingRequests, 0);
});
