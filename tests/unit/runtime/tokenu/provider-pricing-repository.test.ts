import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryProviderPricingRepository } from "@/tokenu/runtime/inMemoryProviderPricingRepository";

test("provider pricing repository selects pricing effective at execution time", async () => {
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
    inputTokenPricePerMillion: 0.1,
    outputTokenPricePerMillion: 0.4,
    effectiveFrom: "2026-10-01T00:00:00.000Z",
  });

  const september = await repository.findEffective(
    "groq",
    "llama-test",
    "2026-09-15T12:00:00.000Z"
  );

  const october = await repository.findEffective("groq", "llama-test", "2026-10-15T12:00:00.000Z");

  assert.equal(september?.inputTokenPricePerMillion, 0.2);

  assert.equal(october?.inputTokenPricePerMillion, 0.1);
});

test("provider pricing repository returns null before first effective price", async () => {
  const repository = new InMemoryProviderPricingRepository();

  await repository.save({
    providerId: "openai",
    modelId: "gpt-test",
    currency: "USD",
    inputTokenPricePerMillion: 2,
    outputTokenPricePerMillion: 8,
    effectiveFrom: "2026-06-01T00:00:00.000Z",
  });

  const pricing = await repository.findEffective("openai", "gpt-test", "2026-05-31T23:59:59.999Z");

  assert.equal(pricing, null);
});

test("provider pricing repository replaces the same effective version", async () => {
  const repository = new InMemoryProviderPricingRepository();

  await repository.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokenPricePerMillion: 0.2,
    outputTokenPricePerMillion: 0.8,
    effectiveFrom: "2026-09-01T00:00:00.000Z",
  });

  await repository.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokenPricePerMillion: 0.25,
    outputTokenPricePerMillion: 0.9,
    effectiveFrom: "2026-09-01T00:00:00.000Z",
  });

  const records = await repository.list();

  assert.equal(records.length, 1);

  assert.equal(records[0]?.inputTokenPricePerMillion, 0.25);
});
