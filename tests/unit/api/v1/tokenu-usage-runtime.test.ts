import assert from "node:assert/strict";
import test from "node:test";

import { handleResolvedTokenUUsageGet } from "@/app/api/v1/tokenu/usage/usageRuntime";
import { getTokenURuntimeComposition } from "@/tokenu/runtime/tokenuRuntimeComposition";

test("resolved TokenU usage bridge reads persistent singleton runtime state", async () => {
  const runtime = getTokenURuntimeComposition();

  const workspaceId = "workspace-p4d-runtime";
  const period = "2026-09";

  await runtime.workspaceRepository.save({
    id: workspaceId,
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  await runtime.workspacePlanRepository.save({
    id: "p4d-runtime-plan",
    tier: "starter",
    monthlyCostLimit: 5,
    monthlyRequestLimit: 10,
    currency: "USD",
  });

  await runtime.workspacePlanAssignmentRepository.save({
    workspaceId,
    planId: "p4d-runtime-plan",
    assignedAt: "2026-09-09T00:01:00.000Z",
  });

  await runtime.workspaceRequestUsageRepository.increment(workspaceId, period);

  await runtime.workspaceUsageMeteringService.record(workspaceId, period, 1000, 500, 99);

  await runtime.providerUsageMeteringService.record(
    workspaceId,
    period,
    "openai",
    "gpt-test",
    1000,
    500,
    88
  );

  await runtime.costLedgerRepository.append({
    workspaceId,
    requestId: "p4d-request-1",
    attemptId: "p4d-attempt-1",
    providerId: "openai",
    modelId: "gpt-test",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 0.25,
    createdAt: "2026-09-09T10:00:00.000Z",
  });

  const response = await handleResolvedTokenUUsageGet(
    new Request("http://localhost/api/v1/tokenu/usage?period=2026-09"),
    workspaceId
  );

  assert.equal(response.status, 200);

  assert.deepEqual(await response.json(), {
    workspaceId,
    period,
    plan: {
      id: "p4d-runtime-plan",
      tier: "starter",
      currency: "USD",
    },
    requests: {
      used: 1,
      limit: 10,
      remaining: 9,
    },
    metering: {
      meteredExecutionCount: 1,
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    },
    spend: {
      total: 0.25,
      limit: 5,
      remaining: 4.75,
      utilizationPercent: 5,
      currency: "USD",
    },
    providers: [
      {
        providerId: "openai",
        modelId: "gpt-test",
        requestCount: 1,
        inputTokens: 1000,
        outputTokens: 500,
      },
    ],
  });
});
