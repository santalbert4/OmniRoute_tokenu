import type { UsageBudget } from "@/tokenu/contracts/usageBudget";
import type { WorkspaceSpendSummary } from "@/tokenu/contracts/workspaceSpendSummary";
import type { CostLedgerRepository } from "@/tokenu/runtime/costLedgerRepository";

export class WorkspaceSpendAggregatorService {
  constructor(private readonly ledgerRepository: CostLedgerRepository) {}

  async summarize(budget: UsageBudget, period: string): Promise<WorkspaceSpendSummary> {
    const totals = await this.ledgerRepository.periodTotals(budget.workspaceId, period);

    const currencyMismatch = totals.find((total) => total.currency !== budget.currency);

    if (currencyMismatch) {
      throw new Error(
        `cost ledger currency mismatch: expected ${budget.currency}, received ${currencyMismatch.currency}`
      );
    }

    const authoritativeTotal = totals.find((total) => total.currency === budget.currency);

    const executionCount = authoritativeTotal?.executionCount ?? 0;

    const totalCost = authoritativeTotal?.totalCost ?? 0;

    const remaining = Math.max(budget.monthlyLimit - totalCost, 0);

    const utilizationPercent =
      budget.monthlyLimit === 0 ? 100 : (totalCost / budget.monthlyLimit) * 100;

    return {
      workspaceId: budget.workspaceId,
      period,
      executionCount,
      totalCost,
      monthlyLimit: budget.monthlyLimit,
      remaining,
      utilizationPercent,
    };
  }
}
