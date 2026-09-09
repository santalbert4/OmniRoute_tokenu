import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryCostLedgerRepository } from "@/tokenu/runtime/inMemoryCostLedgerRepository";
import { InMemoryProviderUsageRepository } from "@/tokenu/runtime/inMemoryProviderUsageRepository";
import { InMemoryWorkspacePlanAssignmentRepository } from "@/tokenu/runtime/inMemoryWorkspacePlanAssignmentRepository";
import { InMemoryWorkspacePlanRepository } from "@/tokenu/runtime/inMemoryWorkspacePlanRepository";
import { InMemoryWorkspaceRequestUsageRepository } from "@/tokenu/runtime/inMemoryWorkspaceRequestUsageRepository";
import { InMemoryWorkspaceUsageMeteringRepository } from "@/tokenu/runtime/inMemoryWorkspaceUsageMeteringRepository";
import { ProviderUsageAggregationService } from "@/tokenu/runtime/providerUsageAggregationService";
import { WorkspacePlanResolverService } from "@/tokenu/runtime/workspacePlanResolverService";
import { WorkspaceSpendAggregatorService } from "@/tokenu/runtime/workspaceSpendAggregatorService";
import { WorkspaceUsageQueryService } from "@/tokenu/runtime/workspaceUsageQueryService";

test("workspace usage query composes authoritative usage sources", async () => {
  const planRepository = new InMemoryWorkspacePlanRepository();

  const assignmentRepository = new InMemoryWorkspacePlanAssignmentRepository();

  const requestRepository = new InMemoryWorkspaceRequestUsageRepository();

  const meteringRepository = new InMemoryWorkspaceUsageMeteringRepository();

  const ledgerRepository = new InMemoryCostLedgerRepository();

  const providerRepository = new InMemoryProviderUsageRepository();

  await planRepository.save({
    id: "plan-pro",
    tier: "pro",
    monthlyCostLimit: 100,
    monthlyRequestLimit: 1000,
    currency: "USD",
  });

  await assignmentRepository.save({
    workspaceId: "workspace-1",
    planId: "plan-pro",
    assignedAt: "2026-09-01T00:00:00.000Z",
  });

  await requestRepository.increment("workspace-1", "2026-09");

  await requestRepository.increment("workspace-1", "2026-09");

  await requestRepository.increment("workspace-1", "2026-09");

  await meteringRepository.save({
    workspaceId: "workspace-1",
    period: "2026-09",
    meteredExecutionCount: 2,
    inputTokens: 1200,
    outputTokens: 300,
    estimatedCost: 999,
  });

  await ledgerRepository.append({
    id: "ledger-1",
    workspaceId: "workspace-1",
    requestId: "request-1",
    providerId: "groq",
    modelId: "model-a",
    currency: "USD",
    inputTokens: 800,
    outputTokens: 200,
    totalTokens: 1000,
    cost: 0.4,
    createdAt: "2026-09-08T12:00:00.000Z",
  });

  await ledgerRepository.append({
    id: "ledger-2",
    workspaceId: "workspace-1",
    requestId: "request-2",
    providerId: "openai",
    modelId: "model-b",
    currency: "USD",
    inputTokens: 400,
    outputTokens: 100,
    totalTokens: 500,
    cost: 0.1,
    createdAt: "2026-09-08T12:01:00.000Z",
  });

  await providerRepository.save({
    workspaceId: "workspace-1",
    period: "2026-09",
    providerId: "groq",
    modelId: "model-a",
    requestCount: 1,
    inputTokens: 800,
    outputTokens: 200,
    estimatedCost: 500,
  });

  await providerRepository.save({
    workspaceId: "workspace-1",
    period: "2026-09",
    providerId: "openai",
    modelId: "model-b",
    requestCount: 1,
    inputTokens: 400,
    outputTokens: 100,
    estimatedCost: 500,
  });

  const service = new WorkspaceUsageQueryService(
    new WorkspacePlanResolverService(assignmentRepository, planRepository),
    requestRepository,
    meteringRepository,
    new WorkspaceSpendAggregatorService(ledgerRepository),
    new ProviderUsageAggregationService(providerRepository)
  );

  const overview = await service.getOverview("workspace-1", "2026-09");

  assert.ok(overview);

  assert.equal(overview.requests.used, 3);
  assert.equal(overview.requests.limit, 1000);
  assert.equal(overview.requests.remaining, 997);

  assert.equal(overview.metering.meteredExecutionCount, 2);

  assert.equal(overview.metering.inputTokens, 1200);
  assert.equal(overview.metering.outputTokens, 300);
  assert.equal(overview.metering.totalTokens, 1500);

  assert.equal(overview.spend.total, 0.5);
  assert.equal(overview.spend.limit, 100);
  assert.equal(overview.spend.remaining, 99.5);
  assert.equal(overview.spend.currency, "USD");

  assert.equal(overview.providers.length, 2);
  assert.equal(overview.providers[0]?.providerId, "groq");
  assert.equal(overview.providers[1]?.providerId, "openai");
});

test("workspace usage query returns null without an assigned plan", async () => {
  const planRepository = new InMemoryWorkspacePlanRepository();

  const assignmentRepository = new InMemoryWorkspacePlanAssignmentRepository();

  const service = new WorkspaceUsageQueryService(
    new WorkspacePlanResolverService(assignmentRepository, planRepository),
    new InMemoryWorkspaceRequestUsageRepository(),
    new InMemoryWorkspaceUsageMeteringRepository(),
    new WorkspaceSpendAggregatorService(new InMemoryCostLedgerRepository()),
    new ProviderUsageAggregationService(new InMemoryProviderUsageRepository())
  );

  const overview = await service.getOverview("workspace-without-plan", "2026-09");

  assert.equal(overview, null);
});
