import type { TenantExecutionPreflightResult } from "@/tokenu/contracts/tenantExecutionPreflightResult";
import type { WorkspacePlanResolverService } from "@/tokenu/runtime/workspacePlanResolverService";
import type { WorkspaceQuotaGateService } from "@/tokenu/runtime/workspaceQuotaGateService";

/**
 * Read-only SaaS admission preflight.
 *
 * This service resolves the tenant plan and evaluates current quota state.
 * It deliberately does not consume request quota. Atomic request admission
 * belongs to the next orchestration boundary.
 */
export class TenantExecutionPreflightService {
  constructor(
    private readonly planResolver: WorkspacePlanResolverService,
    private readonly quotaGate: WorkspaceQuotaGateService
  ) {}

  async evaluate(workspaceId: string, period: string): Promise<TenantExecutionPreflightResult> {
    if (workspaceId.trim().length === 0) {
      throw new Error("TokenU execution preflight requires workspace identity");
    }

    if (period.trim().length === 0) {
      throw new Error("TokenU execution preflight requires usage period");
    }

    const plan = await this.planResolver.resolve(workspaceId);

    if (!plan) {
      return {
        status: "plan-unavailable",
        reason: "workspace plan not assigned",
      };
    }

    const quota = await this.quotaGate.evaluate(workspaceId, period, plan);

    if (!quota.allowed) {
      return {
        status: "quota-denied",
        plan,
        quota,
      };
    }

    return {
      status: "allowed",
      plan,
      quota,
    };
  }
}
