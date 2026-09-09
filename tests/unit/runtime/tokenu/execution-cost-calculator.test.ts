import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionCostCalculator } from "@/tokenu/runtime/executionCostCalculator";
import { InMemoryProviderPricingRepository } from "@/tokenu/runtime/inMemoryProviderPricingRepository";

test("execution cost calculator uses pricing effective when execution was recorded", async () => {
  const repository = new InMemoryProviderPricingRepository();

  await repository.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokenPricePerMillion: 0.2,
    outputTokenPricePerMillion: 0.8,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
  });

  await repository.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokenPricePerMillion: 10,
    outputTokenPricePerMillion: 20,
    effectiveFrom: "2026-10-01T00:00:00.000Z",
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

test("execution cost calculator prices cached input as a subset of total input", async () => {
  const repository = new InMemoryProviderPricingRepository();

  await repository.save({
    providerId: "groq",
    modelId: "openai/gpt-oss-20b",
    currency: "USD",
    inputTokenPricePerMillion: 0.075,
    outputTokenPricePerMillion: 0.3,
    cacheReadTokenPricePerMillion: 0.037,
    cacheWriteTokenPricePerMillion: null,
    effectiveFrom: "2026-09-09T00:00:00.000Z",
  });

  const calculator = new ExecutionCostCalculator(repository);

  const cost = await calculator.calculate({
    requestId: "request-cache",
    attemptId: "attempt-cache",
    providerId: "groq",
    modelId: "openai/gpt-oss-20b",
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      reasoningTokens: null,
      cacheReadTokens: 400,
      cacheWriteTokens: null,
      totalTokens: 1500,
    },
    recordedAt: "2026-09-09T12:00:00.000Z",
  });

  assert.ok(cost);

  const expectedInputCost = (600 / 1_000_000) * 0.075 + (400 / 1_000_000) * 0.037;

  const expectedOutputCost = (500 / 1_000_000) * 0.3;

  assert.ok(Math.abs(cost.inputCost - expectedInputCost) < 1e-12);

  assert.ok(Math.abs(cost.totalCost - (expectedInputCost + expectedOutputCost)) < 1e-12);
});

test("execution cost calculator fails closed when cached usage has no historical cache price", async () => {
  const repository = new InMemoryProviderPricingRepository();

  await repository.save({
    providerId: "groq",
    modelId: "cache-price-missing",
    currency: "USD",
    inputTokenPricePerMillion: 0.075,
    outputTokenPricePerMillion: 0.3,
    effectiveFrom: "2026-09-09T00:00:00.000Z",
  });

  const calculator = new ExecutionCostCalculator(repository);

  const cost = await calculator.calculate({
    requestId: "request-missing-price",
    attemptId: "attempt-missing-price",
    providerId: "groq",
    modelId: "cache-price-missing",
    usage: {
      inputTokens: 1000,
      outputTokens: 0,
      reasoningTokens: null,
      cacheReadTokens: 100,
      cacheWriteTokens: null,
      totalTokens: 1000,
    },
    recordedAt: "2026-09-09T12:00:00.000Z",
  });

  assert.equal(cost, null);
});

test("execution cost calculator fails closed when differentiated cache price exists but cache usage is unknown", async () => {
  const repository = new InMemoryProviderPricingRepository();

  await repository.save({
    providerId: "groq",
    modelId: "cache-usage-unknown",
    currency: "USD",
    inputTokenPricePerMillion: 0.075,
    outputTokenPricePerMillion: 0.3,
    cacheReadTokenPricePerMillion: 0.037,
    effectiveFrom: "2026-09-09T00:00:00.000Z",
  });

  const calculator = new ExecutionCostCalculator(repository);

  const cost = await calculator.calculate({
    requestId: "request-unknown-cache",
    attemptId: "attempt-unknown-cache",
    providerId: "groq",
    modelId: "cache-usage-unknown",
    usage: {
      inputTokens: 1000,
      outputTokens: 0,
      reasoningTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: 1000,
    },
    recordedAt: "2026-09-09T12:00:00.000Z",
  });

  assert.equal(cost, null);
});

test("execution cost calculator rejects cache counts larger than total input", async () => {
  const repository = new InMemoryProviderPricingRepository();

  await repository.save({
    providerId: "groq",
    modelId: "invalid-cache-usage",
    currency: "USD",
    inputTokenPricePerMillion: 0.075,
    outputTokenPricePerMillion: 0.3,
    cacheReadTokenPricePerMillion: 0.037,
    effectiveFrom: "2026-09-09T00:00:00.000Z",
  });

  const calculator = new ExecutionCostCalculator(repository);

  const cost = await calculator.calculate({
    requestId: "request-invalid-cache",
    attemptId: "attempt-invalid-cache",
    providerId: "groq",
    modelId: "invalid-cache-usage",
    usage: {
      inputTokens: 100,
      outputTokens: 0,
      reasoningTokens: null,
      cacheReadTokens: 101,
      cacheWriteTokens: null,
      totalTokens: 100,
    },
    recordedAt: "2026-09-09T12:00:00.000Z",
  });

  assert.equal(cost, null);
});
