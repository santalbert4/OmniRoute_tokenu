import type { ProviderUsageRepository } from "@/tokenu/runtime/providerUsageRepository";

export class ProviderUsageMeteringService {
  constructor(private readonly repository: ProviderUsageRepository) {}

  async record(
    workspaceId: string,
    period: string,
    providerId: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    estimatedCost: number
  ): Promise<void> {
    await this.repository.increment(workspaceId, period, providerId, modelId, {
      inputTokens,
      outputTokens,
      estimatedCost,
    });
  }
}
