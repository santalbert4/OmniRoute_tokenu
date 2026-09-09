import type { WorkspaceUsageMetering } from "@/tokenu/contracts/workspaceUsageMetering";

export interface WorkspaceUsageMeteringIncrement {
  readonly inputTokens: number;

  readonly outputTokens: number;

  readonly estimatedCost: number;
}

export interface WorkspaceUsageMeteringRepository {
  get(workspaceId: string, period: string): Promise<WorkspaceUsageMetering | null>;

  save(usage: WorkspaceUsageMetering): Promise<void>;

  increment(
    workspaceId: string,
    period: string,
    delta: WorkspaceUsageMeteringIncrement
  ): Promise<void>;
}
