import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type {
  ProvisionWorkspaceOwnerInput,
  WorkspaceOwnerOnboardingRepository,
} from "@/tokenu/runtime/workspaceOwnerOnboardingRepository";

interface TokenUUserRow {
  readonly id: string;

  readonly created_at: string;
}

function isTokenUUserRow(value: unknown): value is TokenUUserRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return typeof row.id === "string" && typeof row.created_at === "string";
}

function requireNonBlank(value: string, message: string): void {
  if (!value.trim()) {
    throw new Error(message);
  }
}

/**
 * Creates workspace + TokenU user identity + initial owner membership inside
 * one SQLite transaction.
 *
 * Workspace creation is strict. Existing workspaces are never silently
 * adopted. Existing users may be reused only when their immutable identity
 * metadata matches exactly.
 */
export class SqliteWorkspaceOwnerOnboardingRepository implements WorkspaceOwnerOnboardingRepository {
  constructor(private readonly database: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async provision(input: ProvisionWorkspaceOwnerInput): Promise<void> {
    requireNonBlank(input.workspace.id, "TokenU workspace onboarding requires workspace identity");

    requireNonBlank(
      input.workspace.createdAt,
      "TokenU workspace onboarding requires workspace creation timestamp"
    );

    requireNonBlank(input.owner.id, "TokenU workspace onboarding requires owner identity");

    requireNonBlank(
      input.owner.createdAt,
      "TokenU workspace onboarding requires owner creation timestamp"
    );

    requireNonBlank(
      input.membershipCreatedAt,
      "TokenU workspace onboarding requires membership creation timestamp"
    );

    const transaction = this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO tokenu_workspaces (
             id,
             created_at
           )
           VALUES (?, ?)`
        )
        .run(input.workspace.id, input.workspace.createdAt);

      const existingUser = this.database
        .prepare(
          `SELECT
             id,
             created_at
           FROM tokenu_users
           WHERE id = ?`
        )
        .get(input.owner.id);

      if (existingUser) {
        if (!isTokenUUserRow(existingUser)) {
          throw new Error("Invalid TokenU user row");
        }

        if (existingUser.created_at !== input.owner.createdAt) {
          throw new Error("TokenU user identity is immutable");
        }
      } else {
        this.database
          .prepare(
            `INSERT INTO tokenu_users (
               id,
               created_at
             )
             VALUES (?, ?)`
          )
          .run(input.owner.id, input.owner.createdAt);
      }

      this.database
        .prepare(
          `INSERT INTO tokenu_workspace_memberships (
             workspace_id,
             user_id,
             role,
             created_at
           )
           VALUES (?, ?, 'owner', ?)`
        )
        .run(input.workspace.id, input.owner.id, input.membershipCreatedAt);
    });

    transaction();
  }
}
