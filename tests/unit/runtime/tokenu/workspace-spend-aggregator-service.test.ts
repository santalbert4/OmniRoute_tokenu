import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryCostLedgerRepository } from "@/tokenu/runtime/inMemoryCostLedgerRepository";
import { WorkspaceSpendAggregatorService } from "@/tokenu/runtime/workspaceSpendAggregatorService";

test("workspace spend aggregator only includes workspace entries from requested period", async () => {
  const repository = new InMemoryCostLedgerRepository();

  await repository.append({
    id: "entry-1",
    workspaceId: "workspace-1",
    requestId: "request-1",
    providerId: "openai",
    modelId: "gpt-5",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 2,
    createdAt: "2026-09-05T10:00:00.000Z",
  });

  await repository.append({
    id: "entry-2",
    workspaceId: "workspace-1",
    requestId: "request-2",
    providerId: "openai",
    modelId: "gpt-5",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 50,
    createdAt: "2026-08-31T10:00:00.000Z",
  });

  await repository.append({
    id: "entry-3",
    workspaceId: "workspace-2",
    requestId: "request-3",
    providerId: "openai",
    modelId: "gpt-5",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 75,
    createdAt: "2026-09-05T10:00:00.000Z",
  });

  const service = new WorkspaceSpendAggregatorService(repository);

  const summary = await service.summarize(
    {
      workspaceId: "workspace-1",
      monthlyLimit: 10,
      currentSpend: 0,
      currency: "USD",
    },
    "2026-09"
  );

  assert.equal(summary.workspaceId, "workspace-1");

  assert.equal(summary.period, "2026-09");

  assert.equal(summary.executionCount, 1);

  assert.equal(summary.totalCost, 2);

  assert.equal(summary.remaining, 8);

  assert.equal(summary.utilizationPercent, 20);
});
