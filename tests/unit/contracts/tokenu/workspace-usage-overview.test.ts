import assert from "node:assert/strict";
import test from "node:test";

import type { WorkspaceUsageOverview } from "@/tokenu/contracts/workspaceUsageOverview";

test("workspace usage overview separates quota, metering, spend and provider usage", () => {
  const overview: WorkspaceUsageOverview = {
    workspaceId: "workspace-1",
    period: "2026-09",

    plan: {
      id: "plan-pro",
      tier: "pro",
      currency: "USD",
    },

    requests: {
      used: 100,
      limit: 1000,
      remaining: 900,
    },

    metering: {
      meteredExecutionCount: 95,
      inputTokens: 120000,
      outputTokens: 30000,
      totalTokens: 150000,
    },

    spend: {
      total: 12.5,
      limit: 100,
      remaining: 87.5,
      utilizationPercent: 12.5,
      currency: "USD",
    },

    providers: [
      {
        providerId: "groq",
        modelId: "llama-test",
        requestCount: 60,
        inputTokens: 80000,
        outputTokens: 20000,
      },
    ],
  };

  assert.equal(overview.requests.used, 100);
  assert.equal(overview.metering.meteredExecutionCount, 95);

  assert.notEqual(overview.requests.used, overview.metering.meteredExecutionCount);

  assert.equal(overview.spend.currency, overview.plan.currency);
  assert.equal(overview.providers[0]?.providerId, "groq");
});
