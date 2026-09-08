import assert from "node:assert/strict";
import test from "node:test";

import { BudgetEnforcementService } from "@/tokenu/runtime/budgetEnforcementService";
import { BudgetGuardService } from "@/tokenu/runtime/budgetGuardService";

test("budget enforcement blocks exceeded workspace budget", () => {
  const service = new BudgetEnforcementService(new BudgetGuardService());

  const result = service.enforce({
    workspaceId: "workspace-1",
    monthlyLimit: 10,
    currentSpend: 12,
    currency: "USD",
  });

  assert.equal(result.allowed, false);

  assert.equal(result.reason, "monthly budget exceeded");
});

test("budget enforcement allows usage below limit", () => {
  const service = new BudgetEnforcementService(new BudgetGuardService());

  const result = service.enforce({
    workspaceId: "workspace-1",
    monthlyLimit: 100,
    currentSpend: 25,
    currency: "USD",
  });

  assert.equal(result.allowed, true);

  assert.equal(result.remaining, 75);
});
