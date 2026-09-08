import type { ProviderUsageRecord } from "@/tokenu/contracts/providerUsageRecord";
import type { ProviderUsageRepository } from "@/tokenu/runtime/providerUsageRepository";

export class ProviderUsageAggregationService {
  constructor(private readonly repository: ProviderUsageRepository) {}

  async getUsage(
    workspaceId: string,
    period: string,
    provider: string,
    model: string
  ): Promise<ProviderUsageRecord | null> {
    return this.repository.get(workspaceId, period, provider, model);
  }
}
