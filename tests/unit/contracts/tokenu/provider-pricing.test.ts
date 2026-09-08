import assert from "node:assert/strict";
import test from "node:test";

import type { ProviderPricing } from "@/tokenu/contracts/providerPricing";

test("provider pricing defines token cost contract", () => {
  const pricing: ProviderPricing = {
    providerId: "openai",
    modelId: "gpt-test",
    currency: "USD",
    inputTokenPricePerMillion: 2,
    outputTokenPricePerMillion: 8,
    effectiveFrom: "2026-09-08T00:00:00.000Z",
  };

  assert.equal(pricing.providerId, "openai");

  assert.equal(pricing.currency, "USD");

  assert.equal(pricing.inputTokenPricePerMillion, 2);
});
