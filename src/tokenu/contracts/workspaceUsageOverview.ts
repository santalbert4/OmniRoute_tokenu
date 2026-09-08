import type { WorkspacePlanTier } from "@/tokenu/contracts/workspacePlan";

export interface WorkspaceUsagePlanOverview {
  readonly id: string;
  readonly tier: WorkspacePlanTier;
  readonly currency: string;
}

export interface WorkspaceRequestQuotaOverview {
  readonly used: number;
  readonly limit: number;
  readonly remaining: number;
}

export interface WorkspaceMeteringOverview {
  readonly meteredExecutionCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface WorkspaceSpendOverview {
  readonly total: number;
  readonly limit: number;
  readonly remaining: number;
  readonly utilizationPercent: number;
  readonly currency: string;
}

export interface WorkspaceProviderUsageOverview {
  readonly providerId: string;
  readonly modelId: string;
  readonly requestCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface WorkspaceUsageOverview {
  readonly workspaceId: string;
  readonly period: string;

  readonly plan: WorkspaceUsagePlanOverview;

  readonly requests: WorkspaceRequestQuotaOverview;

  readonly metering: WorkspaceMeteringOverview;

  readonly spend: WorkspaceSpendOverview;

  readonly providers: readonly WorkspaceProviderUsageOverview[];
}
