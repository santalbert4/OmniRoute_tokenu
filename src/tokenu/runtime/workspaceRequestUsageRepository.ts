import type { WorkspaceRequestUsage } from "@/tokenu/contracts/workspaceRequestUsage";

export interface WorkspaceRequestUsageRepository {
  get(workspaceId: string, period: string): Promise<WorkspaceRequestUsage | null>;

  increment(workspaceId: string, period: string): Promise<void>;
}
