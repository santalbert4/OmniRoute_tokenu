import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type { TokenUUser } from "@/tokenu/contracts/humanControlPlaneIdentity";
import type { TokenUUserRepository } from "@/tokenu/runtime/tokenUUserRepository";

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

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`TokenU user requires ${label}`);
  }
}

export class SqliteTokenUUserRepository implements TokenUUserRepository {
  constructor(private readonly db: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async get(userId: string): Promise<TokenUUser | null> {
    if (!userId.trim()) {
      return null;
    }

    const row = this.db
      .prepare(
        `SELECT
           id,
           created_at
         FROM tokenu_users
         WHERE id = ?`
      )
      .get(userId);

    if (!row) {
      return null;
    }

    if (!isTokenUUserRow(row)) {
      throw new Error("Invalid TokenU user row");
    }

    return {
      id: row.id,
      createdAt: row.created_at,
    };
  }

  async save(user: TokenUUser): Promise<void> {
    requireNonBlank(user.id, "identity");
    requireNonBlank(user.createdAt, "creation timestamp");

    this.db
      .prepare(
        `INSERT INTO tokenu_users (
           id,
           created_at
         )
         VALUES (?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .run(user.id, user.createdAt);

    const stored = await this.get(user.id);

    if (!stored) {
      throw new Error("TokenU user identity was not persisted");
    }

    if (stored.createdAt !== user.createdAt) {
      throw new Error("TokenU user identity is immutable");
    }
  }
}
