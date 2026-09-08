import type { WorkspacePlan } from "@/tokenu/contracts/workspacePlan";
import type { WorkspaceQuotaDecision } from "@/tokenu/contracts/workspaceQuotaDecision";
import type { QuotaEnforcementService } from "@/tokenu/runtime/quotaEnforcementService";
import type { RequestQuotaEnforcementService } from "@/tokenu/runtime/requestQuotaEnforcementService";

export class WorkspaceQuotaGateService {
  constructor(
    private readonly costQuotaService: QuotaEnforcementService,
    private readonly requestQuotaService: RequestQuotaEnforcementService
  ) {}

  async evaluate(
    workspaceId: string,
    period: string,
    plan: WorkspacePlan
  ): Promise<WorkspaceQuotaDecision> {
    const cost = await this.costQuotaService.enforce(plan);

    if (!cost.allowed) {
      return {
        allowed: false,
        reason: cost.reason,
        remainingCost: cost.remainingCost,
        remainingRequests: plan.monthlyRequestLimit,
      };
    }

    const requests = await this.requestQuotaService.enforce(workspaceId, period, plan);

    if (!requests.allowed) {
      return {
        allowed: false,
        reason: requests.reason,
        remainingCost: cost.remainingCost,
        remainingRequests: requests.remainingRequests,
      };
    }

    return {
      allowed: true,
      reason: null,
      remainingCost: cost.remainingCost,
      remainingRequests: requests.remainingRequests,
    };
  }
}
