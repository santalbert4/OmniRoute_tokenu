import type { ExecutionUsageRecord } from "@/tokenu/contracts/executionUsageRecord";
import type { UsageBudget } from "@/tokenu/contracts/usageBudget";
import type { UsageMeteringResult } from "@/tokenu/contracts/usageMeteringResult";
import type { BudgetEnforcementService } from "@/tokenu/runtime/budgetEnforcementService";
import type { CostLedgerService } from "@/tokenu/runtime/costLedgerService";

export class UsageMeteringService {
  constructor(
    private readonly budgetService: BudgetEnforcementService,
    private readonly ledgerService: CostLedgerService
  ) {}

  async record(
    record: ExecutionUsageRecord & {
      workspaceId: string;
      id: string;
    },
    budget: UsageBudget
  ): Promise<UsageMeteringResult> {
    const budgetResult = this.budgetService.enforce(budget);

    if (!budgetResult.allowed) {
      return {
        recorded: false,
        cost: 0,
        budgetChecked: true,
        allowed: false,
      };
    }

    const ledgerResult = await this.ledgerService.recordExecution(record);

    return {
      recorded: ledgerResult.recorded,

      cost: ledgerResult.cost,

      budgetChecked: true,

      allowed: true,
    };
  }
}
