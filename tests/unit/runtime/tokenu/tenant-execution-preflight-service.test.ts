import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryCostLedgerRepository } from "@/tokenu/runtime/inMemoryCostLedgerRepository";
import { InMemoryWorkspacePlanAssignmentRepository } from "@/tokenu/runtime/inMemoryWorkspacePlanAssignmentRepository";
import { InMemoryWorkspacePlanRepository } from "@/tokenu/runtime/inMemoryWorkspacePlanRepository";
import { InMemoryWorkspaceRequestUsageRepository } from "@/tokenu/runtime/inMemoryWorkspaceRequestUsageRepository";
import { QuotaEnforcementService } from "@/tokenu/runtime/quotaEnforcementService";
import { RequestQuotaEnforcementService } from "@/tokenu/runtime/requestQuotaEnforcementService";
import { TenantExecutionPreflightService } from "@/tokenu/runtime/tenantExecutionPreflightService";
import { WorkspacePlanResolverService } from "@/tokenu/runtime/workspacePlanResolverService";
import { WorkspaceQuotaGateService } from "@/tokenu/runtime/workspaceQuotaGateService";
import { WorkspaceSpendAggregatorService } from "@/tokenu/runtime/workspaceSpendAggregatorService";

function createFixture() {
  const plans = new InMemoryWorkspacePlanRepository();

  const assignments = new InMemoryWorkspacePlanAssignmentRepository();

  const requests = new InMemoryWorkspaceRequestUsageRepository();

  const ledger = new InMemoryCostLedgerRepository();

  const planResolver = new WorkspacePlanResolverService(assignments, plans);

  const quotaGate = new WorkspaceQuotaGateService(
    new QuotaEnforcementService(new WorkspaceSpendAggregatorService(ledger)),
    new RequestQuotaEnforcementService(requests)
  );

  return {
    plans,
    assignments,
    requests,
    ledger,
    service: new TenantExecutionPreflightService(planResolver, quotaGate),
  };
}

const starterPlan = {
  id: "starter",
  tier: "starter" as const,
  monthlyCostLimit: 10,
  monthlyRequestLimit: 2,
  currency: "USD",
};

test("tenant execution preflight allows workspace with assigned plan and available quota", async () => {
  const fixture = createFixture();

  await fixture.plans.save(starterPlan);

  await fixture.assignments.save({
    workspaceId: "workspace-a",
    planId: "starter",
    assignedAt: "2026-09-09T00:00:00.000Z",
  });

  const result = await fixture.service.evaluate("workspace-a", "2026-09");

  assert.equal(result.status, "allowed");

  if (result.status !== "allowed") {
    assert.fail("Expected allowed preflight");
  }

  assert.equal(result.plan.id, "starter");

  assert.equal(result.quota.remainingRequests, 2);

  assert.equal(result.quota.remainingCost, 10);
});

test("tenant execution preflight fails closed when workspace has no assigned plan", async () => {
  const fixture = createFixture();

  const result = await fixture.service.evaluate("workspace-a", "2026-09");

  assert.deepEqual(result, {
    status: "plan-unavailable",
    reason: "workspace plan not assigned",
  });
});

test("tenant execution preflight denies workspace with exhausted request quota", async () => {
  const fixture = createFixture();

  await fixture.plans.save(starterPlan);

  await fixture.assignments.save({
    workspaceId: "workspace-a",
    planId: "starter",
    assignedAt: "2026-09-09T00:00:00.000Z",
  });

  await fixture.requests.increment("workspace-a", "2026-09");

  await fixture.requests.increment("workspace-a", "2026-09");

  const result = await fixture.service.evaluate("workspace-a", "2026-09");

  assert.equal(result.status, "quota-denied");

  if (result.status !== "quota-denied") {
    assert.fail("Expected quota denial");
  }

  assert.equal(result.quota.reason, "monthly request quota exceeded");

  assert.equal(result.quota.remainingRequests, 0);
});

test("tenant execution preflight is read-only and does not consume request quota", async () => {
  const fixture = createFixture();

  await fixture.plans.save(starterPlan);

  await fixture.assignments.save({
    workspaceId: "workspace-a",
    planId: "starter",
    assignedAt: "2026-09-09T00:00:00.000Z",
  });

  await fixture.service.evaluate("workspace-a", "2026-09");

  await fixture.service.evaluate("workspace-a", "2026-09");

  assert.equal(await fixture.requests.get("workspace-a", "2026-09"), null);
});

test("tenant execution preflight rejects missing trusted context", async () => {
  const fixture = createFixture();

  await assert.rejects(fixture.service.evaluate("   ", "2026-09"), /requires workspace identity/);

  await assert.rejects(fixture.service.evaluate("workspace-a", "   "), /requires usage period/);
});
