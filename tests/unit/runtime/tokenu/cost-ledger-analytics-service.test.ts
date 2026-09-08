import assert from "node:assert/strict";
import test from "node:test";

import { CostLedgerAnalyticsService } from "@/tokenu/runtime/costLedgerAnalyticsService";

test("cost ledger analytics ranks providers and models", () => {
  const service = new CostLedgerAnalyticsService();

  const analytics = service.analyze([
    {
      id: "1",
      workspaceId: "workspace-1",
      requestId: "r1",
      providerId: "groq",
      modelId: "llama-test",
      currency: "USD",
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      cost: 0.0006,
      createdAt: "2026-09-08T12:00:00.000Z",
    },
    {
      id: "2",
      workspaceId: "workspace-1",
      requestId: "r2",
      providerId: "openai",
      modelId: "gpt-test",
      currency: "USD",
      inputTokens: 2000,
      outputTokens: 1000,
      totalTokens: 3000,
      cost: 0.003,
      createdAt: "2026-09-08T12:01:00.000Z",
    },
  ]);

  assert.equal(analytics.executionCount, 2);

  assert.equal(analytics.totalCost, 0.0036);

  assert.equal(analytics.providerRanking[0]?.providerId, "openai");
});
