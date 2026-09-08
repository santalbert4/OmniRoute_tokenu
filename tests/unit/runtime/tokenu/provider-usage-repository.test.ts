import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryProviderUsageRepository } from "@/tokenu/runtime/inMemoryProviderUsageRepository";

test("provider usage repository stores usage by provider and model", async () => {
  const repository = new InMemoryProviderUsageRepository();

  await repository.save({
    workspaceId: "workspace-1",
    period: "2026-09",
    provider: "openai",
    model: "gpt-5",
    requestCount: 10,
    inputTokens: 5000,
    outputTokens: 2000,
    estimatedCost: 0.2,
  });

  const usage = await repository.get("workspace-1", "2026-09", "openai", "gpt-5");

  assert.equal(usage?.requestCount, 10);

  assert.equal(usage?.estimatedCost, 0.2);
});
