import type { WorkspacePlanAssignment } from "@/tokenu/contracts/workspacePlanAssignment";

export interface WorkspacePlanAssignmentRepository {
  get(workspaceId: string): Promise<WorkspacePlanAssignment | null>;

  save(assignment: WorkspacePlanAssignment): Promise<void>;
}
