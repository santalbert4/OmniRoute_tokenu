import type { WorkspacePlan } from "@/tokenu/contracts/workspacePlan";

export interface WorkspacePlanRepository {
  get(planId: string): Promise<WorkspacePlan | null>;

  save(plan: WorkspacePlan): Promise<void>;
}
