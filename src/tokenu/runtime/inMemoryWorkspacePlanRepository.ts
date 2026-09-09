import type { WorkspacePlan } from "@/tokenu/contracts/workspacePlan";
import type { WorkspacePlanRepository } from "@/tokenu/runtime/workspacePlanRepository";

export class InMemoryWorkspacePlanRepository implements WorkspacePlanRepository {
  private readonly plans = new Map<string, WorkspacePlan>();

  async get(planId: string): Promise<WorkspacePlan | null> {
    return this.plans.get(planId) ?? null;
  }

  async save(plan: WorkspacePlan): Promise<void> {
    this.plans.set(plan.id, plan);
  }
}
