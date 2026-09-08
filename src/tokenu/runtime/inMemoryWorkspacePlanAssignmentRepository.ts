import type { WorkspacePlanAssignment } from "@/tokenu/contracts/workspacePlanAssignment";
import type { WorkspacePlanAssignmentRepository } from "@/tokenu/runtime/workspacePlanAssignmentRepository";

export class InMemoryWorkspacePlanAssignmentRepository implements WorkspacePlanAssignmentRepository {
  private readonly assignments = new Map<string, WorkspacePlanAssignment>();

  async get(workspaceId: string): Promise<WorkspacePlanAssignment | null> {
    return this.assignments.get(workspaceId) ?? null;
  }

  async save(assignment: WorkspacePlanAssignment): Promise<void> {
    this.assignments.set(assignment.workspaceId, assignment);
  }
}
