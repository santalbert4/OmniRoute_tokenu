export interface WorkspaceCostSummary {
  readonly workspaceId: string;

  readonly period: string;

  readonly totalRequests: number;

  readonly totalInputTokens: number;

  readonly totalOutputTokens: number;

  readonly estimatedCost: number;
}
