export interface WorkspaceUsageMetering {
  readonly workspaceId: string;

  readonly period: string;

  readonly meteredExecutionCount: number;

  readonly inputTokens: number;

  readonly outputTokens: number;

  readonly estimatedCost: number;
}
