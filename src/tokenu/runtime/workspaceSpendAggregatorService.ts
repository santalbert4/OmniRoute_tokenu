import type { WorkspaceSpendSummary } from "@/tokenu/contracts/workspaceSpendSummary";
import type { CostLedgerRepository } from "@/tokenu/runtime/costLedgerRepository";
import type { UsageBudget } from "@/tokenu/contracts/usageBudget";

export class WorkspaceSpendAggregatorService {
  constructor(private readonly ledgerRepository: CostLedgerRepository) {}

  async summarize(budget: UsageBudget, period: string): Promise<WorkspaceSpendSummary> {
    const workspaceEntries = await this.ledgerRepository.list(budget.workspaceId);

    const entries = workspaceEntries.filter((entry) => entry.createdAt.slice(0, 7) === period);

    const currencyMismatch = entries.find((entry) => entry.currency !== budget.currency);

    if (currencyMismatch) {
      throw new Error(
        `cost ledger currency mismatch: expected ${budget.currency}, received ${currencyMismatch.currency}`
      );
    }

    const totalCost = Number(entries.reduce((total, entry) => total + entry.cost, 0).toFixed(6));

    const remaining = Math.max(budget.monthlyLimit - totalCost, 0);

    const utilizationPercent =
      budget.monthlyLimit === 0 ? 100 : (totalCost / budget.monthlyLimit) * 100;

    return {
      workspaceId: budget.workspaceId,
      period,
      executionCount: entries.length,
      totalCost,
      monthlyLimit: budget.monthlyLimit,
      remaining,
      utilizationPercent,
    };
  }
}
