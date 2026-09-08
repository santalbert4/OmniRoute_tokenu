import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryProviderPricingRepository } from "@/tokenu/runtime/inMemoryProviderPricingRepository";

test("provider pricing repository stores and finds pricing", async () => {
  const repository = new InMemoryProviderPricingRepository();

  await repository.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokenPricePerMillion: 0.2,
    outputTokenPricePerMillion: 0.8,
    effectiveFrom: "2026-09-08T00:00:00.000Z",
  });

  const pricing = await repository.find("groq", "llama-test");

  assert.equal(pricing?.providerId, "groq");

  assert.equal(pricing?.inputTokenPricePerMillion, 0.2);
});
