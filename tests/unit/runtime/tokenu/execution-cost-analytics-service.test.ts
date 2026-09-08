import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionCostAnalyticsService } from "@/tokenu/runtime/executionCostAnalyticsService";

test("execution cost analytics calculates cost rankings", () => {
  const service = new ExecutionCostAnalyticsService();

  const analytics = service.analyze([
    {
      providerId: "groq",
      modelId: "llama-test",
      currency: "USD",
      inputCost: 0.0002,
      outputCost: 0.0004,
      totalCost: 0.0006,
    },
    {
      providerId: "openai",
      modelId: "gpt-test",
      currency: "USD",
      inputCost: 0.001,
      outputCost: 0.002,
      totalCost: 0.003,
    },
  ]);

  assert.equal(analytics.executionCount, 2);

  assert.equal(analytics.totalCost, 0.0036);

  assert.equal(analytics.providerRanking[0]?.providerId, "openai");
});
