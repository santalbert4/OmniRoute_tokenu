import type { WorkspaceUsageMetering } from "@/tokenu/contracts/workspaceUsageMetering";

export interface WorkspaceUsageMeteringRepository {
  get(workspaceId: string, period: string): Promise<WorkspaceUsageMetering | null>;

  save(usage: WorkspaceUsageMetering): Promise<void>;
}
