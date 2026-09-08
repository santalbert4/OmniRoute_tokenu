import type { WorkspaceSpendSummary } from "@/tokenu/contracts/workspaceSpendSummary";
import type { CostLedgerRepository } from "@/tokenu/runtime/costLedgerRepository";
import type { UsageBudget } from "@/tokenu/contracts/usageBudget";

export class WorkspaceSpendAggregatorService {
  constructor(private readonly ledgerRepository: CostLedgerRepository) {}

  async summarize(budget: UsageBudget): Promise<WorkspaceSpendSummary> {
    const entries = await this.ledgerRepository.list(budget.workspaceId);

    const totalCost = await this.ledgerRepository.totalCost(budget.workspaceId);

    const remaining = Math.max(budget.monthlyLimit - totalCost, 0);

    const utilizationPercent =
      budget.monthlyLimit === 0 ? 100 : (totalCost / budget.monthlyLimit) * 100;

    return {
      workspaceId: budget.workspaceId,

      executionCount: entries.length,

      totalCost,

      monthlyLimit: budget.monthlyLimit,

      remaining,

      utilizationPercent,
    };
  }
}
