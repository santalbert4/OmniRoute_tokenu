import type { BudgetStatus } from "@/tokenu/contracts/budgetStatus";

export interface BudgetCheckResult {
  readonly workspaceId: string;

  readonly status: BudgetStatus;

  readonly remaining: number;

  readonly utilizationPercent: number;

  readonly allowed: boolean;
}
