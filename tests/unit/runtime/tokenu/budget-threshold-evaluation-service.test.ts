import assert from "node:assert/strict";
import test from "node:test";

import { BudgetThresholdEvaluationService } from "@/tokenu/runtime/budgetThresholdEvaluationService";

test("budget threshold evaluation returns warning near limit", () => {
  const service = new BudgetThresholdEvaluationService();

  const result = service.evaluate("workspace-1", "2026-09", 80, 100);

  assert.equal(result.usagePercent, 80);

  assert.equal(result.status, "warning");
});

test("budget threshold evaluation blocks exceeded budget", () => {
  const service = new BudgetThresholdEvaluationService();

  const result = service.evaluate("workspace-1", "2026-09", 120, 100);

  assert.equal(result.status, "blocked");
});

test("budget threshold evaluation allows normal usage", () => {
  const service = new BudgetThresholdEvaluationService();

  const result = service.evaluate("workspace-1", "2026-09", 20, 100);

  assert.equal(result.status, "ok");
});
