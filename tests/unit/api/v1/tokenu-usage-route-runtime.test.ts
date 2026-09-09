import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "@/app/api/v1/tokenu/usage/route";
import { getTokenURuntimeComposition } from "@/tokenu/runtime/tokenuRuntimeComposition";

function usageRequest(apiKey: string, query = "period=2026-09"): Request {
  return new Request(`http://localhost/api/v1/tokenu/usage?${query}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

test("production TokenU usage route isolates real API keys by persistent workspace binding", async () => {
  const runtime = getTokenURuntimeComposition();

  const workspaceA = "workspace-p4e-a";
  const workspaceB = "workspace-p4e-b";
  const period = "2026-09";

  await runtime.workspaceRepository.save({
    id: workspaceA,
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  await runtime.workspaceRepository.save({
    id: workspaceB,
    createdAt: "2026-09-09T00:01:00.000Z",
  });

  await runtime.workspacePlanRepository.save({
    id: "p4e-plan",
    tier: "starter",
    monthlyCostLimit: 10,
    monthlyRequestLimit: 100,
    currency: "USD",
  });

  await runtime.workspacePlanAssignmentRepository.save({
    workspaceId: workspaceA,
    planId: "p4e-plan",
    assignedAt: "2026-09-09T00:02:00.000Z",
  });

  await runtime.workspacePlanAssignmentRepository.save({
    workspaceId: workspaceB,
    planId: "p4e-plan",
    assignedAt: "2026-09-09T00:03:00.000Z",
  });

  const keyA = await runtime.tokenUApiKeyService.create({
    name: "TokenU P7C A",
    createdAt: "2026-09-09T00:03:10.000Z",
  });

  const keyB = await runtime.tokenUApiKeyService.create({
    name: "TokenU P7C B",
    createdAt: "2026-09-09T00:03:20.000Z",
  });

  const unassignedKey = await runtime.tokenUApiKeyService.create({
    name: "TokenU P7C unassigned",
    createdAt: "2026-09-09T00:03:30.000Z",
  });

  const revokedKey = await runtime.tokenUApiKeyService.create({
    name: "TokenU P7C revoked",
    createdAt: "2026-09-09T00:03:40.000Z",
  });

  await runtime.tokenUApiKeyService.revoke(revokedKey.id, "2026-09-09T00:03:50.000Z");

  const expiredKey = await runtime.tokenUApiKeyService.create({
    name: "TokenU P7C expired",
    createdAt: "2020-01-01T00:00:00.000Z",
    expiresAt: "2020-01-02T00:00:00.000Z",
  });

  await runtime.workspacePrincipalRepository.save({
    workspaceId: workspaceA,
    principalType: "api_key",
    principalId: keyA.id,
    assignedAt: "2026-09-09T00:04:00.000Z",
  });

  await runtime.workspacePrincipalRepository.save({
    workspaceId: workspaceB,
    principalType: "api_key",
    principalId: keyB.id,
    assignedAt: "2026-09-09T00:05:00.000Z",
  });

  await runtime.workspacePrincipalRepository.save({
    workspaceId: workspaceA,
    principalType: "api_key",
    principalId: revokedKey.id,
    assignedAt: "2026-09-09T00:05:10.000Z",
  });

  await runtime.workspacePrincipalRepository.save({
    workspaceId: workspaceA,
    principalType: "api_key",
    principalId: expiredKey.id,
    assignedAt: "2026-09-09T00:05:20.000Z",
  });

  await runtime.workspaceRequestUsageRepository.increment(workspaceA, period);

  await runtime.workspaceUsageMeteringService.record(workspaceA, period, 1000, 500, 99);

  await runtime.providerUsageMeteringService.record(
    workspaceA,
    period,
    "openai",
    "model-a",
    1000,
    500,
    88
  );

  await runtime.costLedgerRepository.append({
    workspaceId: workspaceA,
    requestId: "request-a",
    attemptId: "attempt-a",
    providerId: "openai",
    modelId: "model-a",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 0.25,
    createdAt: "2026-09-09T10:00:00.000Z",
  });

  await runtime.workspaceRequestUsageRepository.increment(workspaceB, period);

  await runtime.workspaceRequestUsageRepository.increment(workspaceB, period);

  await runtime.workspaceUsageMeteringService.record(workspaceB, period, 4000, 1000, 77);

  await runtime.providerUsageMeteringService.record(
    workspaceB,
    period,
    "groq",
    "model-b",
    4000,
    1000,
    66
  );

  await runtime.costLedgerRepository.append({
    workspaceId: workspaceB,
    requestId: "request-b",
    attemptId: "attempt-b",
    providerId: "groq",
    modelId: "model-b",
    currency: "USD",
    inputTokens: 4000,
    outputTokens: 1000,
    totalTokens: 5000,
    cost: 0.75,
    createdAt: "2026-09-09T11:00:00.000Z",
  });

  const responseA = await GET(usageRequest(keyA.token));

  assert.equal(responseA.status, 200);

  assert.deepEqual(await responseA.json(), {
    workspaceId: workspaceA,
    period,
    plan: {
      id: "p4e-plan",
      tier: "starter",
      currency: "USD",
    },
    requests: {
      used: 1,
      limit: 100,
      remaining: 99,
    },
    metering: {
      meteredExecutionCount: 1,
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    },
    spend: {
      total: 0.25,
      limit: 10,
      remaining: 9.75,
      utilizationPercent: 2.5,
      currency: "USD",
    },
    providers: [
      {
        providerId: "openai",
        modelId: "model-a",
        requestCount: 1,
        inputTokens: 1000,
        outputTokens: 500,
      },
    ],
  });

  const responseB = await GET(usageRequest(keyB.token));

  assert.equal(responseB.status, 200);

  assert.deepEqual(await responseB.json(), {
    workspaceId: workspaceB,
    period,
    plan: {
      id: "p4e-plan",
      tier: "starter",
      currency: "USD",
    },
    requests: {
      used: 2,
      limit: 100,
      remaining: 98,
    },
    metering: {
      meteredExecutionCount: 1,
      inputTokens: 4000,
      outputTokens: 1000,
      totalTokens: 5000,
    },
    spend: {
      total: 0.75,
      limit: 10,
      remaining: 9.25,
      utilizationPercent: 7.5,
      currency: "USD",
    },
    providers: [
      {
        providerId: "groq",
        modelId: "model-b",
        requestCount: 1,
        inputTokens: 4000,
        outputTokens: 1000,
      },
    ],
  });

  const overrideAttempt = await GET(
    usageRequest(keyA.token, "period=2026-09&workspaceId=workspace-p4e-b")
  );

  assert.equal(overrideAttempt.status, 400);

  assert.deepEqual(await overrideAttempt.json(), {
    error: {
      code: "unsupported_query_parameter",
      message: "Unsupported query parameter: workspaceId",
    },
  });

  const unassignedResponse = await GET(usageRequest(unassignedKey.token));

  assert.equal(unassignedResponse.status, 403);

  assert.deepEqual(await unassignedResponse.json(), {
    error: {
      code: "workspace_not_assigned",
      message: "API key is not assigned to a TokenU workspace",
    },
  });

  const revokedResponse = await GET(usageRequest(revokedKey.token));

  assert.equal(revokedResponse.status, 401);

  assert.deepEqual(await revokedResponse.json(), {
    error: {
      code: "unauthorized",
      message: "Unauthorized",
    },
  });

  const expiredResponse = await GET(usageRequest(expiredKey.token));

  assert.equal(expiredResponse.status, 401);

  assert.deepEqual(await expiredResponse.json(), {
    error: {
      code: "unauthorized",
      message: "Unauthorized",
    },
  });

  const invalidResponse = await GET(usageRequest("definitely-not-a-valid-token"));

  assert.equal(invalidResponse.status, 401);

  assert.deepEqual(await invalidResponse.json(), {
    error: {
      code: "unauthorized",
      message: "Unauthorized",
    },
  });
});
