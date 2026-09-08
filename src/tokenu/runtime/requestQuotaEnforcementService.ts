import type { WorkspacePlan } from "@/tokenu/contracts/workspacePlan";
import type { RequestQuotaResult } from "@/tokenu/contracts/requestQuotaResult";
import type { WorkspaceRequestUsageRepository } from "@/tokenu/runtime/workspaceRequestUsageRepository";

export class RequestQuotaEnforcementService {
  constructor(private readonly usageRepository: WorkspaceRequestUsageRepository) {}

  async enforce(
    workspaceId: string,
    period: string,
    plan: WorkspacePlan
  ): Promise<RequestQuotaResult> {
    const usage = await this.usageRepository.get(workspaceId, period);

    const currentRequests = usage?.requestCount ?? 0;

    const remainingRequests = Math.max(plan.monthlyRequestLimit - currentRequests, 0);

    if (remainingRequests <= 0) {
      return {
        allowed: false,
        remainingRequests,
        reason: "monthly request quota exceeded",
      };
    }

    return {
      allowed: true,
      remainingRequests,
      reason: null,
    };
  }
}
