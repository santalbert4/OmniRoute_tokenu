import type { BudgetEvaluation } from "@/tokenu/contracts/budgetEvaluation";

export class BudgetThresholdEvaluationService {
  evaluate(
    workspaceId: string,
    period: string,
    estimatedCost: number,
    budgetLimit: number
  ): BudgetEvaluation {
    const usagePercent =
      budgetLimit === 0 ? 100 : Number(((estimatedCost / budgetLimit) * 100).toFixed(2));

    let status: BudgetEvaluation["status"];

    if (usagePercent >= 100) {
      status = "blocked";
    } else if (usagePercent >= 80) {
      status = "warning";
    } else {
      status = "ok";
    }

    return {
      workspaceId,

      period,

      estimatedCost,

      budgetLimit,

      usagePercent,

      status,
    };
  }
}
