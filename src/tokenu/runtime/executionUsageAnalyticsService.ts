import type { ExecutionUsageRepository } from "@/tokenu/runtime/executionUsageRepository";
import type { UsageAnalytics } from "@/tokenu/contracts/usageAnalytics";

export class ExecutionUsageAnalyticsService {
  constructor(private readonly repository: ExecutionUsageRepository) {}

  async analyze(): Promise<UsageAnalytics> {
    const records = await this.repository.list();

    const providers = new Map<string, number>();

    const models = new Map<string, number>();

    let totalTokens = 0;

    for (const record of records) {
      const tokens = record.usage.totalTokens ?? 0;

      totalTokens += tokens;

      providers.set(record.providerId, (providers.get(record.providerId) ?? 0) + tokens);

      models.set(record.modelId, (models.get(record.modelId) ?? 0) + tokens);
    }

    return {
      totalRequests: records.length,

      totalTokens,

      averageTokensPerRequest: records.length === 0 ? 0 : totalTokens / records.length,

      providerRanking: [...providers.entries()]
        .map(([providerId, tokens]) => ({
          providerId,
          tokens,
        }))
        .sort((a, b) => b.tokens - a.tokens),

      modelRanking: [...models.entries()]
        .map(([modelId, tokens]) => ({
          modelId,
          tokens,
        }))
        .sort((a, b) => b.tokens - a.tokens),
    };
  }
}
