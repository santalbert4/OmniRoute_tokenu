export type BudgetEvaluationStatus = "ok" | "warning" | "blocked";

export interface BudgetEvaluation {
  readonly workspaceId: string;

  readonly period: string;

  readonly estimatedCost: number;

  readonly budgetLimit: number;

  readonly usagePercent: number;

  readonly status: BudgetEvaluationStatus;
}
