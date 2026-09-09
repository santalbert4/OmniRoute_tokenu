import type { ProviderUsageRecord } from "@/tokenu/contracts/providerUsageRecord";
import type {
  ProviderUsageIncrement,
  ProviderUsageRepository,
} from "@/tokenu/runtime/providerUsageRepository";

export class InMemoryProviderUsageRepository implements ProviderUsageRepository {
  private readonly usage = new Map<string, ProviderUsageRecord>();

  private key(workspaceId: string, period: string, providerId: string, modelId: string): string {
    return [workspaceId, period, providerId, modelId].join(":");
  }

  async get(
    workspaceId: string,
    period: string,
    providerId: string,
    modelId: string
  ): Promise<ProviderUsageRecord | null> {
    return this.usage.get(this.key(workspaceId, period, providerId, modelId)) ?? null;
  }

  async list(workspaceId: string, period: string): Promise<readonly ProviderUsageRecord[]> {
    return Array.from(this.usage.values()).filter(
      (usage) => usage.workspaceId === workspaceId && usage.period === period
    );
  }

  async save(usage: ProviderUsageRecord): Promise<void> {
    this.usage.set(
      this.key(usage.workspaceId, usage.period, usage.providerId, usage.modelId),
      usage
    );
  }

  async increment(
    workspaceId: string,
    period: string,
    providerId: string,
    modelId: string,
    delta: ProviderUsageIncrement
  ): Promise<void> {
    const key = this.key(workspaceId, period, providerId, modelId);

    const existing = this.usage.get(key);

    this.usage.set(key, {
      workspaceId,
      period,
      providerId,
      modelId,
      requestCount: (existing?.requestCount ?? 0) + 1,
      inputTokens: (existing?.inputTokens ?? 0) + delta.inputTokens,
      outputTokens: (existing?.outputTokens ?? 0) + delta.outputTokens,
      estimatedCost: Number(((existing?.estimatedCost ?? 0) + delta.estimatedCost).toFixed(6)),
    });
  }
}
