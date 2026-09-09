import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryProviderUsageRepository } from "@/tokenu/runtime/inMemoryProviderUsageRepository";

test("provider usage repository stores usage by provider and model", async () => {
  const repository = new InMemoryProviderUsageRepository();

  await repository.save({
    workspaceId: "workspace-1",
    period: "2026-09",
    providerId: "openai",
    modelId: "gpt-5",
    requestCount: 10,
    inputTokens: 5000,
    outputTokens: 2000,
    estimatedCost: 0.2,
  });

  const usage = await repository.get("workspace-1", "2026-09", "openai", "gpt-5");

  assert.equal(usage?.requestCount, 10);

  assert.equal(usage?.estimatedCost, 0.2);
});

test("provider usage repository lists usage by workspace and period", async () => {
  const repository = new InMemoryProviderUsageRepository();

  await repository.save({
    workspaceId: "workspace-1",
    period: "2026-09",
    providerId: "groq",
    modelId: "model-a",
    requestCount: 10,
    inputTokens: 1000,
    outputTokens: 500,
    estimatedCost: 0.1,
  });

  await repository.save({
    workspaceId: "workspace-1",
    period: "2026-10",
    providerId: "groq",
    modelId: "model-b",
    requestCount: 20,
    inputTokens: 2000,
    outputTokens: 1000,
    estimatedCost: 0.2,
  });

  await repository.save({
    workspaceId: "workspace-2",
    period: "2026-09",
    providerId: "groq",
    modelId: "model-c",
    requestCount: 30,
    inputTokens: 3000,
    outputTokens: 1500,
    estimatedCost: 0.3,
  });

  const usages = await repository.list("workspace-1", "2026-09");

  assert.equal(usages.length, 1);
  assert.equal(usages[0]?.modelId, "model-a");
});

test("provider usage repository increments usage deltas by provider and model", async () => {
  const repository = new InMemoryProviderUsageRepository();

  await repository.increment("workspace-1", "2026-09", "openai", "gpt-5", {
    inputTokens: 1000,
    outputTokens: 500,
    estimatedCost: 0.05,
  });

  await repository.increment("workspace-1", "2026-09", "openai", "gpt-5", {
    inputTokens: 2000,
    outputTokens: 1000,
    estimatedCost: 0.1,
  });

  const usage = await repository.get("workspace-1", "2026-09", "openai", "gpt-5");

  assert.equal(usage?.requestCount, 2);

  assert.equal(usage?.inputTokens, 3000);

  assert.equal(usage?.outputTokens, 1500);

  assert.equal(usage?.estimatedCost, 0.15);
});
