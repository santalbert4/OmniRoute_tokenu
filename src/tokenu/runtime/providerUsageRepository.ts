import type { ProviderUsageRecord } from "@/tokenu/contracts/providerUsageRecord";

export interface ProviderUsageRepository {
  get(
    workspaceId: string,
    period: string,
    provider: string,
    model: string
  ): Promise<ProviderUsageRecord | null>;

  save(usage: ProviderUsageRecord): Promise<void>;
}
