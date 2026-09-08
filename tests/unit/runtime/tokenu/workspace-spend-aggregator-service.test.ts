import assert from "node:assert/strict";
import test from "node:test";

import { WorkspaceSpendAggregatorService } from "@/tokenu/runtime/workspaceSpendAggregatorService";
import { InMemoryCostLedgerRepository } from "@/tokenu/runtime/inMemoryCostLedgerRepository";

test("workspace spend aggregator summarizes usage", async () => {
  const repository = new InMemoryCostLedgerRepository();

  await repository.append({
    id: "1",
    workspaceId: "workspace-1",
    requestId: "r1",
    providerId: "openai",
    modelId: "gpt-test",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 2,
    createdAt: "2026-09-08T12:00:00.000Z",
  });

  const service = new WorkspaceSpendAggregatorService(repository);

  const result = await service.summarize({
    workspaceId: "workspace-1",
    monthlyLimit: 10,
    currentSpend: 0,
    currency: "USD",
  });

  assert.equal(result.executionCount, 1);

  assert.equal(result.totalCost, 2);

  assert.equal(result.remaining, 8);
});
