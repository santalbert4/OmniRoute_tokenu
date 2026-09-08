import assert from "node:assert/strict";
import test from "node:test";

import { ProviderUsageMeteringService } from "@/tokenu/runtime/providerUsageMeteringService";
import { InMemoryProviderUsageRepository } from "@/tokenu/runtime/inMemoryProviderUsageRepository";

test("provider usage metering accumulates usage by provider and model", async () => {
  const repository = new InMemoryProviderUsageRepository();

  const service = new ProviderUsageMeteringService(repository);

  await service.record("workspace-1", "2026-09", "openai", "gpt-5", 1000, 500, 0.05);

  await service.record("workspace-1", "2026-09", "openai", "gpt-5", 2000, 1000, 0.1);

  const usage = await repository.get("workspace-1", "2026-09", "openai", "gpt-5");

  assert.equal(usage?.requestCount, 2);

  assert.equal(usage?.inputTokens, 3000);

  assert.equal(usage?.outputTokens, 1500);

  assert.equal(usage?.estimatedCost, 0.15);
});
