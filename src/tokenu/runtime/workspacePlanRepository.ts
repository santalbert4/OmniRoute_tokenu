import type { WorkspacePlan } from "@/tokenu/contracts/workspacePlan";

export interface WorkspacePlanRepository {
  get(workspaceId: string): Promise<WorkspacePlan | null>;

  save(workspaceId: string, plan: WorkspacePlan): Promise<void>;
}
