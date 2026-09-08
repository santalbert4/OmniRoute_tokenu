import type { UsageBudget } from "@/tokenu/contracts/usageBudget";
import type { BudgetCheckResult } from "@/tokenu/contracts/budgetCheckResult";

export class BudgetGuardService {
  check(budget: UsageBudget): BudgetCheckResult {
    const utilizationPercent =
      budget.monthlyLimit === 0 ? 100 : (budget.currentSpend / budget.monthlyLimit) * 100;

    let status: "ok" | "warning" | "exceeded";

    if (utilizationPercent >= 100) {
      status = "exceeded";
    } else if (utilizationPercent >= 80) {
      status = "warning";
    } else {
      status = "ok";
    }

    return {
      workspaceId: budget.workspaceId,

      status,

      remaining: Math.max(budget.monthlyLimit - budget.currentSpend, 0),

      utilizationPercent,

      allowed: status !== "exceeded",
    };
  }
}
