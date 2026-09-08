export interface ProviderUsageRecord {
  readonly workspaceId: string;

  readonly period: string;

  readonly provider: string;

  readonly model: string;

  readonly requestCount: number;

  readonly inputTokens: number;

  readonly outputTokens: number;

  readonly estimatedCost: number;
}
