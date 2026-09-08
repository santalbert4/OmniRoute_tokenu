export interface ProviderUsageRecord {
  readonly workspaceId: string;

  readonly period: string;

  readonly providerId: string;

  readonly modelId: string;

  readonly requestCount: number;

  readonly inputTokens: number;

  readonly outputTokens: number;

  readonly estimatedCost: number;
}
