import type { ProviderUsageRecord } from "@/tokenu/contracts/providerUsageRecord";
import type { ProviderUsageRepository } from "@/tokenu/runtime/providerUsageRepository";

export class ProviderUsageAggregationService {
  constructor(private readonly repository: ProviderUsageRepository) {}

  async listUsage(workspaceId: string, period: string): Promise<readonly ProviderUsageRecord[]> {
    return this.repository.list(workspaceId, period);
  }

  async getUsage(
    workspaceId: string,
    period: string,
    providerId: string,
    modelId: string
  ): Promise<ProviderUsageRecord | null> {
    return this.repository.get(workspaceId, period, providerId, modelId);
  }
}
