import type { WorkspacePlan } from "@/tokenu/contracts/workspacePlan";
import type { WorkspacePlanRepository } from "@/tokenu/runtime/workspacePlanRepository";

export class WorkspacePlanResolverService {
  constructor(private readonly repository: WorkspacePlanRepository) {}

  async resolve(workspaceId: string): Promise<WorkspacePlan | null> {
    return this.repository.get(workspaceId);
  }
}
