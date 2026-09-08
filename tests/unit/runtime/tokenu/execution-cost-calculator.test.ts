import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionCostCalculator } from "@/tokenu/runtime/executionCostCalculator";
import { InMemoryProviderPricingRepository } from "@/tokenu/runtime/inMemoryProviderPricingRepository";

test("execution cost calculator calculates provider cost", async () => {
  const repository = new InMemoryProviderPricingRepository();

  await repository.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokenPricePerMillion: 0.2,
    outputTokenPricePerMillion: 0.8,
    effectiveFrom: "2026-09-08T00:00:00.000Z",
  });

  const calculator = new ExecutionCostCalculator(repository);

  const cost = await calculator.calculate({
    requestId: "request-1",
    attemptId: "attempt-1",
    providerId: "groq",
    modelId: "llama-test",
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      reasoningTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: 1500,
    },
    recordedAt: "2026-09-08T12:00:00.000Z",
  });

  assert.ok(cost);

  assert.equal(cost.currency, "USD");

  assert.ok(Math.abs(cost.totalCost - 0.0006) < 1e-12);
});
