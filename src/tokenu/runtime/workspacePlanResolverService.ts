import type { WorkspacePlan } from "@/tokenu/contracts/workspacePlan";
import type { WorkspacePlanRepository } from "@/tokenu/runtime/workspacePlanRepository";
import type { WorkspacePlanAssignmentRepository } from "@/tokenu/runtime/workspacePlanAssignmentRepository";

export class WorkspacePlanResolverService {
  constructor(
    private readonly assignmentRepository: WorkspacePlanAssignmentRepository,
    private readonly planRepository: WorkspacePlanRepository
  ) {}

  async resolve(workspaceId: string): Promise<WorkspacePlan | null> {
    const assignment = await this.assignmentRepository.get(workspaceId);

    if (!assignment) {
      return null;
    }

    return this.planRepository.get(assignment.planId);
  }
}
