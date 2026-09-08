import type { WorkspaceSpendAggregatorService } from "@/tokenu/runtime/workspaceSpendAggregatorService";
import type { WorkspacePlan } from "@/tokenu/contracts/workspacePlan";
import type { QuotaEnforcementResult } from "@/tokenu/contracts/quotaEnforcementResult";

export class QuotaEnforcementService {
  constructor(private readonly spendAggregator: WorkspaceSpendAggregatorService) {}

  async enforce(
    workspaceId: string,
    period: string,
    plan: WorkspacePlan
  ): Promise<QuotaEnforcementResult> {
    const summary = await this.spendAggregator.summarize(
      {
        workspaceId,
        monthlyLimit: plan.monthlyCostLimit,
        currentSpend: 0,
        currency: plan.currency,
      },
      period
    );

    const remainingCost = Math.max(plan.monthlyCostLimit - summary.totalCost, 0);

    if (remainingCost <= 0) {
      return {
        allowed: false,
        reason: "monthly cost quota exceeded",
        remainingCost,
        remainingRequests: plan.monthlyRequestLimit,
      };
    }

    return {
      allowed: true,
      reason: null,
      remainingCost,
      remainingRequests: plan.monthlyRequestLimit,
    };
  }
}
