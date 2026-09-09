import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryCostLedgerRepository } from "@/tokenu/runtime/inMemoryCostLedgerRepository";
import { QuotaEnforcementService } from "@/tokenu/runtime/quotaEnforcementService";
import { WorkspaceSpendAggregatorService } from "@/tokenu/runtime/workspaceSpendAggregatorService";

test("cost quota uses workspace id rather than plan id", async () => {
  const repository = new InMemoryCostLedgerRepository();

  await repository.append({
    workspaceId: "workspace-1",
    requestId: "request-1",
    attemptId: "request-1-attempt",
    providerId: "openai",
    modelId: "gpt-5",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 10,
    createdAt: "2026-09-05T10:00:00.000Z",
  });

  const service = new QuotaEnforcementService(new WorkspaceSpendAggregatorService(repository));

  const result = await service.enforce("workspace-1", "2026-09", {
    id: "starter",
    tier: "starter",
    monthlyCostLimit: 10,
    monthlyRequestLimit: 1000,
    currency: "USD",
  });

  assert.equal(result.allowed, false);

  assert.equal(result.remainingCost, 0);

  assert.equal(result.reason, "monthly cost quota exceeded");
});

test("cost quota ignores another workspace and previous periods", async () => {
  const repository = new InMemoryCostLedgerRepository();

  await repository.append({
    workspaceId: "workspace-1",
    requestId: "request-old",
    attemptId: "request-old-attempt",
    providerId: "openai",
    modelId: "gpt-5",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 100,
    createdAt: "2026-08-20T10:00:00.000Z",
  });

  await repository.append({
    workspaceId: "workspace-2",
    requestId: "request-other",
    attemptId: "request-other-attempt",
    providerId: "openai",
    modelId: "gpt-5",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 100,
    createdAt: "2026-09-05T10:00:00.000Z",
  });

  const service = new QuotaEnforcementService(new WorkspaceSpendAggregatorService(repository));

  const result = await service.enforce("workspace-1", "2026-09", {
    id: "starter",
    tier: "starter",
    monthlyCostLimit: 10,
    monthlyRequestLimit: 1000,
    currency: "USD",
  });

  assert.equal(result.allowed, true);

  assert.equal(result.remainingCost, 10);
});
