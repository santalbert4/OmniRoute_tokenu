import type {
  TokenUPrincipalType,
  TokenUWorkspacePrincipal,
} from "@/tokenu/contracts/workspaceIdentity";
import type { WorkspacePrincipalRepository } from "@/tokenu/runtime/workspacePrincipalRepository";
import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";

interface WorkspacePrincipalRow {
  readonly workspace_id: string;
  readonly principal_type: TokenUPrincipalType;
  readonly principal_id: string;
  readonly assigned_at: string;
}

function isWorkspacePrincipalRow(value: unknown): value is WorkspacePrincipalRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.workspace_id === "string" &&
    row.principal_type === "api_key" &&
    typeof row.principal_id === "string" &&
    typeof row.assigned_at === "string"
  );
}

export class SqliteWorkspacePrincipalRepository implements WorkspacePrincipalRepository {
  constructor(private readonly db: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async get(
    principalType: TokenUPrincipalType,
    principalId: string
  ): Promise<TokenUWorkspacePrincipal | null> {
    const row = this.db
      .prepare(
        `SELECT
           workspace_id,
           principal_type,
           principal_id,
           assigned_at
         FROM tokenu_workspace_principals
         WHERE principal_type = ?
           AND principal_id = ?`
      )
      .get(principalType, principalId);

    if (!row) {
      return null;
    }

    if (!isWorkspacePrincipalRow(row)) {
      throw new Error("Invalid TokenU workspace principal row");
    }

    return {
      workspaceId: row.workspace_id,
      principalType: row.principal_type,
      principalId: row.principal_id,
      assignedAt: row.assigned_at,
    };
  }

  async save(binding: TokenUWorkspacePrincipal): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO tokenu_workspace_principals (
           workspace_id,
           principal_type,
           principal_id,
           assigned_at
         )
         VALUES (?, ?, ?, ?)
         ON CONFLICT(principal_type, principal_id)
         DO NOTHING`
      )
      .run(binding.workspaceId, binding.principalType, binding.principalId, binding.assignedAt);

    const stored = await this.get(binding.principalType, binding.principalId);

    if (!stored) {
      throw new Error("TokenU principal assignment was not persisted");
    }

    if (stored.workspaceId !== binding.workspaceId) {
      throw new Error("TokenU principal already assigned to another workspace");
    }
  }
}
