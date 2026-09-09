import type { WorkspaceRequestUsage } from "@/tokenu/contracts/workspaceRequestUsage";
import type { WorkspaceRequestUsageRepository } from "@/tokenu/runtime/workspaceRequestUsageRepository";
import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";

interface WorkspaceRequestUsageRow {
  readonly workspace_id: string;
  readonly period: string;
  readonly request_count: number;
}

function isWorkspaceRequestUsageRow(value: unknown): value is WorkspaceRequestUsageRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.workspace_id === "string" &&
    row.workspace_id.trim().length > 0 &&
    typeof row.period === "string" &&
    row.period.trim().length > 0 &&
    typeof row.request_count === "number" &&
    Number.isSafeInteger(row.request_count) &&
    row.request_count >= 0
  );
}

export class SqliteWorkspaceRequestUsageRepository implements WorkspaceRequestUsageRepository {
  constructor(private readonly db: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async get(workspaceId: string, period: string): Promise<WorkspaceRequestUsage | null> {
    const row = this.db
      .prepare(
        `SELECT
           workspace_id,
           period,
           request_count
         FROM tokenu_workspace_request_usage
         WHERE workspace_id = ?
           AND period = ?`
      )
      .get(workspaceId, period);

    if (!row) {
      return null;
    }

    if (!isWorkspaceRequestUsageRow(row)) {
      throw new Error("Invalid TokenU workspace request usage row");
    }

    return {
      workspaceId: row.workspace_id,
      period: row.period,
      requestCount: row.request_count,
    };
  }

  async increment(workspaceId: string, period: string): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO tokenu_workspace_request_usage (
           workspace_id,
           period,
           request_count
         )
         VALUES (?, ?, 1)
         ON CONFLICT(workspace_id, period)
         DO UPDATE SET
           request_count =
             tokenu_workspace_request_usage.request_count + 1`
      )
      .run(workspaceId, period);
  }
}
