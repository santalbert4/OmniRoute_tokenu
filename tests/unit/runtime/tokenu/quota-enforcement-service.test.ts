import assert from "node:assert/strict";
import test from "node:test";

import { QuotaEnforcementService } from "@/tokenu/runtime/quotaEnforcementService";
import { WorkspaceSpendAggregatorService } from "@/tokenu/runtime/workspaceSpendAggregatorService";
import { InMemoryCostLedgerRepository } from "@/tokenu/runtime/inMemoryCostLedgerRepository";

test("quota enforcement allows workspace below plan limit", async () => {
  const service = new QuotaEnforcementService(
    new WorkspaceSpendAggregatorService(new InMemoryCostLedgerRepository())
  );

  const result = await service.enforce({
    id: "workspace-1",
    tier: "pro",
    monthlyCostLimit: 50,
    monthlyRequestLimit: 10000,
    currency: "USD",
  });

  assert.equal(result.allowed, true);

  assert.equal(result.remainingCost, 50);
});
