import assert from "node:assert/strict";
import test from "node:test";

import { ProviderUsageAggregationService } from "@/tokenu/runtime/providerUsageAggregationService";
import { InMemoryProviderUsageRepository } from "@/tokenu/runtime/inMemoryProviderUsageRepository";

test("provider usage aggregation returns stored provider usage", async () => {
  const repository = new InMemoryProviderUsageRepository();

  await repository.save({
    workspaceId: "workspace-1",
    period: "2026-09",
    provider: "openai",
    model: "gpt-5",
    requestCount: 20,
    inputTokens: 10000,
    outputTokens: 5000,
    estimatedCost: 0.75,
  });

  const service = new ProviderUsageAggregationService(repository);

  const usage = await service.getUsage("workspace-1", "2026-09", "openai", "gpt-5");

  assert.equal(usage?.requestCount, 20);

  assert.equal(usage?.estimatedCost, 0.75);
});
