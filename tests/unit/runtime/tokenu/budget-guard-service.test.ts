import assert from "node:assert/strict";
import test from "node:test";

import { BudgetGuardService } from "@/tokenu/runtime/budgetGuardService";

test("budget guard blocks exceeded budgets", () => {
  const service = new BudgetGuardService();

  const result = service.check({
    workspaceId: "workspace-1",
    monthlyLimit: 10,
    currentSpend: 12,
    currency: "USD",
  });

  assert.equal(result.status, "exceeded");

  assert.equal(result.allowed, false);

  assert.equal(result.remaining, 0);
});
