import type { ProviderUsageRecord } from "@/tokenu/contracts/providerUsageRecord";
import type { ProviderUsageRepository } from "@/tokenu/runtime/providerUsageRepository";

export class InMemoryProviderUsageRepository implements ProviderUsageRepository {
  private readonly usage = new Map<string, ProviderUsageRecord>();

  async get(
    workspaceId: string,
    period: string,
    providerId: string,
    modelId: string
  ): Promise<ProviderUsageRecord | null> {
    const key = `${workspaceId}:${period}:${providerId}:${modelId}`;

    return this.usage.get(key) ?? null;
  }

  async list(workspaceId: string, period: string): Promise<readonly ProviderUsageRecord[]> {
    return Array.from(this.usage.values()).filter(
      (usage) => usage.workspaceId === workspaceId && usage.period === period
    );
  }

  async save(usage: ProviderUsageRecord): Promise<void> {
    const key = `${usage.workspaceId}:${usage.period}:${usage.providerId}:${usage.modelId}`;

    this.usage.set(key, usage);
  }
}
