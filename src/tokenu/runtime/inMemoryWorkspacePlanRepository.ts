import type { WorkspacePlan } from "@/tokenu/contracts/workspacePlan";
import type { WorkspacePlanRepository } from "@/tokenu/runtime/workspacePlanRepository";

export class InMemoryWorkspacePlanRepository implements WorkspacePlanRepository {
  private readonly plans = new Map<string, WorkspacePlan>();

  async get(workspaceId: string): Promise<WorkspacePlan | null> {
    return this.plans.get(workspaceId) ?? null;
  }

  async save(workspaceId: string, plan: WorkspacePlan): Promise<void> {
    this.plans.set(workspaceId, plan);
  }
}
