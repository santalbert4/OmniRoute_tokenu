import type { UsageBudget } from "@/tokenu/contracts/usageBudget";
import type { BudgetEnforcementResult } from "@/tokenu/contracts/budgetEnforcementResult";
import type { BudgetGuardService } from "@/tokenu/runtime/budgetGuardService";

export class BudgetEnforcementService {
  constructor(private readonly budgetGuard: BudgetGuardService) {}

  enforce(budget: UsageBudget): BudgetEnforcementResult {
    const result = this.budgetGuard.check(budget);

    if (!result.allowed) {
      return {
        allowed: false,
        remaining: result.remaining,
        reason: "monthly budget exceeded",
      };
    }

    return {
      allowed: true,
      remaining: result.remaining,
      reason: null,
    };
  }
}
