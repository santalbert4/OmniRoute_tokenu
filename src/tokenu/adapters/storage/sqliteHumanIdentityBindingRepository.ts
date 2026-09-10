import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type { HumanIdentityBinding } from "@/tokenu/contracts/humanAuthenticationIdentity";
import type { HumanIdentityBindingRepository } from "@/tokenu/runtime/humanIdentityBindingRepository";

interface HumanIdentityBindingRow {
  readonly authority: string;
  readonly subject: string;
  readonly user_id: string;
  readonly created_at: string;
}

function isHumanIdentityBindingRow(value: unknown): value is HumanIdentityBindingRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.authority === "string" &&
    typeof row.subject === "string" &&
    typeof row.user_id === "string" &&
    typeof row.created_at === "string"
  );
}

export class SqliteHumanIdentityBindingRepository implements HumanIdentityBindingRepository {
  constructor(private readonly db: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async get(authority: string, subject: string): Promise<HumanIdentityBinding | null> {
    if (!authority.trim() || !subject.trim()) {
      return null;
    }

    const row = this.db
      .prepare(
        `SELECT
           authority,
           subject,
           user_id,
           created_at
         FROM tokenu_human_identity_bindings
         WHERE authority = ?
           AND subject = ?`
      )
      .get(authority, subject);

    if (!row) {
      return null;
    }

    if (!isHumanIdentityBindingRow(row)) {
      throw new Error("Invalid human identity binding row");
    }

    return {
      authority: row.authority,
      subject: row.subject,
      userId: row.user_id,
      createdAt: row.created_at,
    };
  }
}
