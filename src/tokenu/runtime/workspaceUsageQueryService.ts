import type { WorkspaceUsageOverview } from "@/tokenu/contracts/workspaceUsageOverview";
import type { ProviderUsageAggregationService } from "@/tokenu/runtime/providerUsageAggregationService";
import type { WorkspacePlanResolverService } from "@/tokenu/runtime/workspacePlanResolverService";
import type { WorkspaceRequestUsageRepository } from "@/tokenu/runtime/workspaceRequestUsageRepository";
import type { WorkspaceSpendAggregatorService } from "@/tokenu/runtime/workspaceSpendAggregatorService";
import type { WorkspaceUsageMeteringRepository } from "@/tokenu/runtime/workspaceUsageMeteringRepository";

export class WorkspaceUsageQueryService {
  constructor(
    private readonly planResolver: WorkspacePlanResolverService,
    private readonly requestUsageRepository: WorkspaceRequestUsageRepository,
    private readonly meteringRepository: WorkspaceUsageMeteringRepository,
    private readonly spendAggregator: WorkspaceSpendAggregatorService,
    private readonly providerUsageService: ProviderUsageAggregationService
  ) {}

  async getOverview(workspaceId: string, period: string): Promise<WorkspaceUsageOverview | null> {
    const plan = await this.planResolver.resolve(workspaceId);

    if (!plan) {
      return null;
    }

    const [requestUsage, metering, spend, providerUsages] = await Promise.all([
      this.requestUsageRepository.get(workspaceId, period),
      this.meteringRepository.get(workspaceId, period),
      this.spendAggregator.summarize(
        {
          workspaceId,
          monthlyLimit: plan.monthlyCostLimit,
          currentSpend: 0,
          currency: plan.currency,
        },
        period
      ),
      this.providerUsageService.listUsage(workspaceId, period),
    ]);

    const usedRequests = requestUsage?.requestCount ?? 0;

    const providers = providerUsages
      .map((usage) => ({
        providerId: usage.providerId,
        modelId: usage.modelId,
        requestCount: usage.requestCount,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      }))
      .sort((a, b) => {
        const providerOrder = a.providerId.localeCompare(b.providerId);

        return providerOrder !== 0 ? providerOrder : a.modelId.localeCompare(b.modelId);
      });

    const inputTokens = metering?.inputTokens ?? 0;
    const outputTokens = metering?.outputTokens ?? 0;

    return {
      workspaceId,
      period,

      plan: {
        id: plan.id,
        tier: plan.tier,
        currency: plan.currency,
      },

      requests: {
        used: usedRequests,
        limit: plan.monthlyRequestLimit,
        remaining: Math.max(plan.monthlyRequestLimit - usedRequests, 0),
      },

      metering: {
        meteredExecutionCount: metering?.meteredExecutionCount ?? 0,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },

      spend: {
        total: spend.totalCost,
        limit: spend.monthlyLimit,
        remaining: spend.remaining,
        utilizationPercent: spend.utilizationPercent,
        currency: plan.currency,
      },

      providers,
    };
  }
}
