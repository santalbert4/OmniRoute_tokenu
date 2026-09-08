export interface WorkspaceSpendSummary {
  readonly workspaceId: string;

  readonly period: string;

  readonly executionCount: number;

  readonly totalCost: number;

  readonly monthlyLimit: number;

  readonly remaining: number;

  readonly utilizationPercent: number;
}
