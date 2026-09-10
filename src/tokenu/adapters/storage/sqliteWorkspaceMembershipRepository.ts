import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type {
  TokenUWorkspaceMembership,
  TokenUWorkspaceRole,
} from "@/tokenu/contracts/humanControlPlaneIdentity";
import type { WorkspaceMembershipRepository } from "@/tokenu/runtime/workspaceMembershipRepository";

interface WorkspaceMembershipRow {
  readonly workspace_id: string;
  readonly user_id: string;
  readonly role: TokenUWorkspaceRole;
  readonly created_at: string;
}

function isWorkspaceRole(value: unknown): value is TokenUWorkspaceRole {
  return value === "owner" || value === "admin" || value === "member";
}

function isWorkspaceMembershipRow(value: unknown): value is WorkspaceMembershipRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.workspace_id === "string" &&
    typeof row.user_id === "string" &&
    isWorkspaceRole(row.role) &&
    typeof row.created_at === "string"
  );
}

function toMembership(row: WorkspaceMembershipRow): TokenUWorkspaceMembership {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
  };
}

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`TokenU workspace membership requires ${label}`);
  }
}

function requireWorkspaceRole(role: TokenUWorkspaceRole): void {
  if (!isWorkspaceRole(role)) {
    throw new Error("Invalid TokenU workspace membership role");
  }
}

export class SqliteWorkspaceMembershipRepository implements WorkspaceMembershipRepository {
  constructor(private readonly db: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async get(workspaceId: string, userId: string): Promise<TokenUWorkspaceMembership | null> {
    if (!workspaceId.trim() || !userId.trim()) {
      return null;
    }

    const row = this.db
      .prepare(
        `SELECT
           workspace_id,
           user_id,
           role,
           created_at
         FROM tokenu_workspace_memberships
         WHERE workspace_id = ?
           AND user_id = ?`
      )
      .get(workspaceId, userId);

    if (!row) {
      return null;
    }

    if (!isWorkspaceMembershipRow(row)) {
      throw new Error("Invalid TokenU workspace membership row");
    }

    return toMembership(row);
  }

  async listByUser(userId: string): Promise<readonly TokenUWorkspaceMembership[]> {
    if (!userId.trim()) {
      return [];
    }

    const statement = this.db.prepare(
      `SELECT
         workspace_id,
         user_id,
         role,
         created_at
       FROM tokenu_workspace_memberships
       WHERE user_id = ?
       ORDER BY workspace_id ASC`
    );

    if (typeof statement.all !== "function") {
      throw new Error("TokenU SQLite statement does not support row enumeration");
    }

    return statement.all(userId).map((row) => {
      if (!isWorkspaceMembershipRow(row)) {
        throw new Error("Invalid TokenU workspace membership row");
      }

      return toMembership(row);
    });
  }

  async listByWorkspace(workspaceId: string): Promise<readonly TokenUWorkspaceMembership[]> {
    if (!workspaceId.trim()) {
      return [];
    }

    const statement = this.db.prepare(
      `SELECT
         workspace_id,
         user_id,
         role,
         created_at
       FROM tokenu_workspace_memberships
       WHERE workspace_id = ?
       ORDER BY
         created_at ASC,
         user_id ASC`
    );

    if (typeof statement.all !== "function") {
      throw new Error("TokenU SQLite statement does not support row enumeration");
    }

    return statement.all(workspaceId).map((row) => {
      if (!isWorkspaceMembershipRow(row)) {
        throw new Error("Invalid TokenU workspace membership row");
      }

      return toMembership(row);
    });
  }

  async create(membership: TokenUWorkspaceMembership): Promise<void> {
    requireNonBlank(membership.workspaceId, "workspace identity");
    requireNonBlank(membership.userId, "user identity");
    requireNonBlank(membership.createdAt, "creation timestamp");
    requireWorkspaceRole(membership.role);

    this.db
      .prepare(
        `INSERT INTO tokenu_workspace_memberships (
           workspace_id,
           user_id,
           role,
           created_at
         )
         VALUES (?, ?, ?, ?)`
      )
      .run(membership.workspaceId, membership.userId, membership.role, membership.createdAt);
  }

  async updateRole(
    workspaceId: string,
    userId: string,
    role: TokenUWorkspaceRole
  ): Promise<boolean> {
    if (!workspaceId.trim() || !userId.trim()) {
      return false;
    }

    requireWorkspaceRole(role);

    const result = this.db
      .prepare(
        `UPDATE tokenu_workspace_memberships
         SET role = ?
         WHERE workspace_id = ?
           AND user_id = ?`
      )
      .run(role, workspaceId, userId);

    return (result.changes ?? 0) > 0;
  }

  async remove(workspaceId: string, userId: string): Promise<boolean> {
    if (!workspaceId.trim() || !userId.trim()) {
      return false;
    }

    const result = this.db
      .prepare(
        `DELETE FROM tokenu_workspace_memberships
         WHERE workspace_id = ?
           AND user_id = ?`
      )
      .run(workspaceId, userId);

    return (result.changes ?? 0) > 0;
  }
}
