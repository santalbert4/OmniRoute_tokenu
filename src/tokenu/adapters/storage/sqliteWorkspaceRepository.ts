import type { TokenUWorkspace } from "@/tokenu/contracts/workspaceIdentity";
import type { WorkspaceRepository } from "@/tokenu/runtime/workspaceRepository";
import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";

interface WorkspaceRow {
  readonly id: string;
  readonly created_at: string;
}

function isWorkspaceRow(value: unknown): value is WorkspaceRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return typeof row.id === "string" && typeof row.created_at === "string";
}

export class SqliteWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async get(workspaceId: string): Promise<TokenUWorkspace | null> {
    const row = this.db
      .prepare(
        `SELECT id, created_at
         FROM tokenu_workspaces
         WHERE id = ?`
      )
      .get(workspaceId);

    if (!row) {
      return null;
    }

    if (!isWorkspaceRow(row)) {
      throw new Error("Invalid TokenU workspace row");
    }

    return {
      id: row.id,
      createdAt: row.created_at,
    };
  }

  async save(workspace: TokenUWorkspace): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO tokenu_workspaces (
           id,
           created_at
         )
         VALUES (?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .run(workspace.id, workspace.createdAt);
  }
}
