import type { ProviderUsageRecord } from "@/tokenu/contracts/providerUsageRecord";
import type { ProviderUsageRepository } from "@/tokenu/runtime/providerUsageRepository";

export class InMemoryProviderUsageRepository implements ProviderUsageRepository {
  private readonly usage = new Map<string, ProviderUsageRecord>();

  async get(
    workspaceId: string,
    period: string,
    provider: string,
    model: string
  ): Promise<ProviderUsageRecord | null> {
    const key = `${workspaceId}:${period}:${provider}:${model}`;

    return this.usage.get(key) ?? null;
  }

  async save(usage: ProviderUsageRecord): Promise<void> {
    const key = `${usage.workspaceId}:${usage.period}:${usage.provider}:${usage.model}`;

    this.usage.set(key, usage);
  }
}
