import assert from "node:assert/strict";
import test from "node:test";

import { ProviderUsageAggregationService } from "@/tokenu/runtime/providerUsageAggregationService";
import { InMemoryProviderUsageRepository } from "@/tokenu/runtime/inMemoryProviderUsageRepository";

test("provider usage aggregation returns stored provider usage", async () => {
  const repository = new InMemoryProviderUsageRepository();

  await repository.save({
    workspaceId: "workspace-1",
    period: "2026-09",
    providerId: "openai",
    modelId: "gpt-5",
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

test("provider usage aggregation lists workspace usage for a period", async () => {
  const repository = new InMemoryProviderUsageRepository();

  const service = new ProviderUsageAggregationService(repository);

  await repository.save({
    workspaceId: "workspace-1",
    period: "2026-09",
    providerId: "groq",
    modelId: "model-a",
    requestCount: 5,
    inputTokens: 500,
    outputTokens: 250,
    estimatedCost: 0.05,
  });

  await repository.save({
    workspaceId: "workspace-1",
    period: "2026-10",
    providerId: "groq",
    modelId: "model-b",
    requestCount: 7,
    inputTokens: 700,
    outputTokens: 350,
    estimatedCost: 0.07,
  });

  const usages = await service.listUsage("workspace-1", "2026-09");

  assert.equal(usages.length, 1);
  assert.equal(usages[0]?.modelId, "model-a");
});
