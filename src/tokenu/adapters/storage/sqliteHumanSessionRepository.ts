import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type { TokenUHumanSession } from "@/tokenu/contracts/humanSession";
import { isHumanSessionSecretHash } from "@/tokenu/runtime/humanSessionMaterial";
import type { HumanSessionRepository } from "@/tokenu/runtime/humanSessionRepository";

interface HumanSessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly secret_hash: string;
  readonly created_at: string;
  readonly expires_at: string;
  readonly revoked_at: string | null;
}

function isHumanSessionRow(value: unknown): value is HumanSessionRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.id === "string" &&
    typeof row.user_id === "string" &&
    typeof row.secret_hash === "string" &&
    typeof row.created_at === "string" &&
    typeof row.expires_at === "string" &&
    (row.revoked_at === null || typeof row.revoked_at === "string")
  );
}

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`Human session requires ${label}`);
  }
}

function requireTimestamp(value: string, label: string): number {
  requireNonBlank(value, label);

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Human session has invalid ${label}`);
  }

  return timestamp;
}

export class SqliteHumanSessionRepository implements HumanSessionRepository {
  constructor(private readonly db: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async get(sessionId: string): Promise<TokenUHumanSession | null> {
    if (!sessionId.trim()) {
      return null;
    }

    const row = this.db
      .prepare(
        `SELECT
           id,
           user_id,
           secret_hash,
           created_at,
           expires_at,
           revoked_at
         FROM tokenu_human_sessions
         WHERE id = ?`
      )
      .get(sessionId);

    if (!row) {
      return null;
    }

    if (!isHumanSessionRow(row)) {
      throw new Error("Invalid human session row");
    }

    if (
      !row.id.trim() ||
      !row.user_id.trim() ||
      !isHumanSessionSecretHash(row.secret_hash) ||
      !row.created_at.trim() ||
      !row.expires_at.trim() ||
      (row.revoked_at !== null && !row.revoked_at.trim())
    ) {
      throw new Error("Invalid human session row");
    }

    return {
      id: row.id,
      userId: row.user_id,
      secretHash: row.secret_hash,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    };
  }

  async create(session: TokenUHumanSession): Promise<void> {
    requireNonBlank(session.id, "identity");
    requireNonBlank(session.userId, "TokenU user identity");

    if (!isHumanSessionSecretHash(session.secretHash)) {
      throw new Error("Human session requires valid secret hash");
    }

    const createdAt = requireTimestamp(session.createdAt, "creation timestamp");
    const expiresAt = requireTimestamp(session.expiresAt, "expiry timestamp");

    if (expiresAt <= createdAt) {
      throw new Error("Human session expiry must be after creation");
    }

    if (session.revokedAt !== null) {
      const revokedAt = requireTimestamp(session.revokedAt, "revocation timestamp");

      if (revokedAt < createdAt) {
        throw new Error("Human session revocation cannot predate creation");
      }
    }

    this.db
      .prepare(
        `INSERT INTO tokenu_human_sessions (
           id,
           user_id,
           secret_hash,
           created_at,
           expires_at,
           revoked_at
         )
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.userId,
        session.secretHash,
        session.createdAt,
        session.expiresAt,
        session.revokedAt
      );
  }

  async revoke(sessionId: string, revokedAt: string): Promise<boolean> {
    if (!sessionId.trim()) {
      return false;
    }

    const existing = await this.get(sessionId);

    if (!existing) {
      return false;
    }

    if (existing.revokedAt !== null) {
      return true;
    }

    const revokedTimestamp = requireTimestamp(revokedAt, "revocation timestamp");
    const createdTimestamp = requireTimestamp(existing.createdAt, "creation timestamp");

    if (revokedTimestamp < createdTimestamp) {
      throw new Error("Human session revocation cannot predate creation");
    }

    const result = this.db
      .prepare(
        `UPDATE tokenu_human_sessions
         SET revoked_at = ?
         WHERE id = ?
           AND revoked_at IS NULL`
      )
      .run(revokedAt, sessionId);

    if (result.changes > 0) {
      return true;
    }

    const current = await this.get(sessionId);

    return current?.revokedAt !== null;
  }
}
