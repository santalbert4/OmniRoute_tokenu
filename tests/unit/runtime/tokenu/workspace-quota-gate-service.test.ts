import assert from "node:assert/strict";
import test from "node:test";

import { WorkspaceQuotaGateService } from "@/tokenu/runtime/workspaceQuotaGateService";
import { QuotaEnforcementService } from "@/tokenu/runtime/quotaEnforcementService";
import { RequestQuotaEnforcementService } from "@/tokenu/runtime/requestQuotaEnforcementService";
import { InMemoryWorkspaceRequestUsageRepository } from "@/tokenu/runtime/inMemoryWorkspaceRequestUsageRepository";
import { WorkspaceSpendAggregatorService } from "@/tokenu/runtime/workspaceSpendAggregatorService";
import { InMemoryCostLedgerRepository } from "@/tokenu/runtime/inMemoryCostLedgerRepository";

test("workspace quota gate allows workspace within cost and request limits", async () => {
  const requestRepository = new InMemoryWorkspaceRequestUsageRepository();

  const service = new WorkspaceQuotaGateService(
    new QuotaEnforcementService(
      new WorkspaceSpendAggregatorService(new InMemoryCostLedgerRepository())
    ),
    new RequestQuotaEnforcementService(requestRepository)
  );

  const decision = await service.evaluate("workspace-1", "2026-09", {
    id: "starter",
    tier: "starter",
    monthlyCostLimit: 10,
    monthlyRequestLimit: 1000,
    currency: "USD",
  });

  assert.equal(decision.allowed, true);

  assert.equal(decision.remainingRequests, 1000);
});

test("workspace quota gate blocks workspace exceeding request quota", async () => {
  const requestRepository = new InMemoryWorkspaceRequestUsageRepository();

  await requestRepository.increment("workspace-1", "2026-09");

  const service = new WorkspaceQuotaGateService(
    new QuotaEnforcementService(
      new WorkspaceSpendAggregatorService(new InMemoryCostLedgerRepository())
    ),
    new RequestQuotaEnforcementService(requestRepository)
  );

  const decision = await service.evaluate("workspace-1", "2026-09", {
    id: "starter",
    tier: "starter",
    monthlyCostLimit: 10,
    monthlyRequestLimit: 1,
    currency: "USD",
  });

  assert.equal(decision.allowed, false);

  assert.equal(decision.reason, "monthly request quota exceeded");
});
