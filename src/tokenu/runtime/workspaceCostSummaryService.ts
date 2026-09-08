import type { WorkspaceCostSummary } from "@/tokenu/contracts/workspaceCostSummary";
import type { ProviderUsageRecord } from "@/tokenu/contracts/providerUsageRecord";

export class WorkspaceCostSummaryService {
  summarize(
    workspaceId: string,
    period: string,
    usages: ProviderUsageRecord[]
  ): WorkspaceCostSummary {
    const filtered = usages.filter(
      (usage) => usage.workspaceId === workspaceId && usage.period === period
    );

    return {
      workspaceId,

      period,

      totalRequests: filtered.reduce((sum, usage) => sum + usage.requestCount, 0),

      totalInputTokens: filtered.reduce((sum, usage) => sum + usage.inputTokens, 0),

      totalOutputTokens: filtered.reduce((sum, usage) => sum + usage.outputTokens, 0),

      estimatedCost: Number(
        filtered.reduce((sum, usage) => sum + usage.estimatedCost, 0).toFixed(6)
      ),
    };
  }
}
