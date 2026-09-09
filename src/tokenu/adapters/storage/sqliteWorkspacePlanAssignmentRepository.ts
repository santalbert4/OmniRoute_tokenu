import type { WorkspacePlanAssignment } from "@/tokenu/contracts/workspacePlanAssignment";
import type { WorkspacePlanAssignmentRepository } from "@/tokenu/runtime/workspacePlanAssignmentRepository";
import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";

interface WorkspacePlanAssignmentRow {
  readonly workspace_id: string;
  readonly plan_id: string;
  readonly assigned_at: string;
}

function isWorkspacePlanAssignmentRow(value: unknown): value is WorkspacePlanAssignmentRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.workspace_id === "string" &&
    row.workspace_id.trim().length > 0 &&
    typeof row.plan_id === "string" &&
    row.plan_id.trim().length > 0 &&
    typeof row.assigned_at === "string"
  );
}

export class SqliteWorkspacePlanAssignmentRepository implements WorkspacePlanAssignmentRepository {
  constructor(private readonly db: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async get(workspaceId: string): Promise<WorkspacePlanAssignment | null> {
    const row = this.db
      .prepare(
        `SELECT
           workspace_id,
           plan_id,
           assigned_at
         FROM tokenu_workspace_plan_assignments
         WHERE workspace_id = ?`
      )
      .get(workspaceId);

    if (!row) {
      return null;
    }

    if (!isWorkspacePlanAssignmentRow(row)) {
      throw new Error("Invalid TokenU workspace plan assignment row");
    }

    return {
      workspaceId: row.workspace_id,
      planId: row.plan_id,
      assignedAt: row.assigned_at,
    };
  }

  async save(assignment: WorkspacePlanAssignment): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO tokenu_workspace_plan_assignments (
           workspace_id,
           plan_id,
           assigned_at
         )
         VALUES (?, ?, ?)
         ON CONFLICT(workspace_id)
         DO UPDATE SET
           plan_id = excluded.plan_id,
           assigned_at = excluded.assigned_at`
      )
      .run(assignment.workspaceId, assignment.planId, assignment.assignedAt);
  }
}
