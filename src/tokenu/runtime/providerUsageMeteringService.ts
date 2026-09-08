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
    const existing = await this.repository.get(workspaceId, period, providerId, modelId);

    await this.repository.save({
      workspaceId,
      period,
      providerId,
      modelId,

      requestCount: (existing?.requestCount ?? 0) + 1,

      inputTokens: (existing?.inputTokens ?? 0) + inputTokens,

      outputTokens: (existing?.outputTokens ?? 0) + outputTokens,

      estimatedCost: Number(((existing?.estimatedCost ?? 0) + estimatedCost).toFixed(6)),
    });
  }
}
