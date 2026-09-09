import type { ProviderUsageRecord } from "@/tokenu/contracts/providerUsageRecord";

export interface ProviderUsageIncrement {
  readonly inputTokens: number;

  readonly outputTokens: number;

  readonly estimatedCost: number;
}

export interface ProviderUsageRepository {
  get(
    workspaceId: string,
    period: string,
    providerId: string,
    modelId: string
  ): Promise<ProviderUsageRecord | null>;

  list(workspaceId: string, period: string): Promise<readonly ProviderUsageRecord[]>;

  save(usage: ProviderUsageRecord): Promise<void>;

  increment(
    workspaceId: string,
    period: string,
    providerId: string,
    modelId: string,
    delta: ProviderUsageIncrement
  ): Promise<void>;
}
