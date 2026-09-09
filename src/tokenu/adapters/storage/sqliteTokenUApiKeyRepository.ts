import type { TokenUApiKey } from "@/tokenu/contracts/tokenUApiKey";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type { TokenUApiKeyRepository } from "@/tokenu/runtime/tokenUApiKeyRepository";

interface TokenUApiKeyRow {
  readonly id: string;
  readonly name: string;
  readonly key_prefix: string;
  readonly key_hash: string;
  readonly created_at: string;
  readonly expires_at: string | null;
  readonly revoked_at: string | null;
  readonly last_used_at: string | null;
}

function normalizeRequiredTimestamp(value: string, fieldName: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid TokenU API key ${fieldName}`);
  }

  return parsed.toISOString();
}

function normalizeOptionalTimestamp(value: string | null, fieldName: string): string | null {
  if (value === null) {
    return null;
  }

  return normalizeRequiredTimestamp(value, fieldName);
}

function rowToApiKey(row: TokenUApiKeyRow): TokenUApiKey {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    keyHash: row.key_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
  };
}

export class SqliteTokenUApiKeyRepository implements TokenUApiKeyRepository {
  constructor(private readonly database: TokenUSqliteDatabase) {}

  async getById(apiKeyId: string): Promise<TokenUApiKey | null> {
    if (!apiKeyId.trim()) {
      return null;
    }

    const row = this.database
      .prepare(
        `SELECT
           id,
           name,
           key_prefix,
           key_hash,
           created_at,
           expires_at,
           revoked_at,
           last_used_at
         FROM tokenu_api_keys
         WHERE id = ?`
      )
      .get(apiKeyId) as TokenUApiKeyRow | undefined;

    return row ? rowToApiKey(row) : null;
  }

  async getByHash(keyHash: string): Promise<TokenUApiKey | null> {
    if (!keyHash.trim()) {
      return null;
    }

    const row = this.database
      .prepare(
        `SELECT
           id,
           name,
           key_prefix,
           key_hash,
           created_at,
           expires_at,
           revoked_at,
           last_used_at
         FROM tokenu_api_keys
         WHERE key_hash = ?`
      )
      .get(keyHash) as TokenUApiKeyRow | undefined;

    return row ? rowToApiKey(row) : null;
  }

  async touchLastUsedAt(apiKeyId: string, usedAt: string): Promise<void> {
    if (!apiKeyId.trim()) {
      return;
    }

    const normalizedUsedAt = normalizeRequiredTimestamp(usedAt, "lastUsedAt");

    this.database
      .prepare(
        `UPDATE tokenu_api_keys
         SET last_used_at = ?
         WHERE id = ?
           AND (
             last_used_at IS NULL
             OR julianday(last_used_at) < julianday(?)
           )`
      )
      .run(normalizedUsedAt, apiKeyId, normalizedUsedAt);
  }

  async save(apiKey: TokenUApiKey): Promise<void> {
    if (!apiKey.id.trim()) {
      throw new Error("TokenU API key requires identity");
    }

    if (!apiKey.name.trim()) {
      throw new Error("TokenU API key requires name");
    }

    if (!apiKey.keyPrefix.trim()) {
      throw new Error("TokenU API key requires display prefix");
    }

    if (!/^[0-9a-f]{64}$/.test(apiKey.keyHash)) {
      throw new Error("TokenU API key requires a lowercase SHA-256 hash");
    }

    const createdAt = normalizeRequiredTimestamp(apiKey.createdAt, "createdAt");
    const expiresAt = normalizeOptionalTimestamp(apiKey.expiresAt, "expiresAt");
    const revokedAt = normalizeOptionalTimestamp(apiKey.revokedAt, "revokedAt");
    const lastUsedAt = normalizeOptionalTimestamp(apiKey.lastUsedAt, "lastUsedAt");

    const existing = await this.getById(apiKey.id);

    if (
      existing !== null &&
      (existing.keyHash !== apiKey.keyHash || existing.keyPrefix !== apiKey.keyPrefix)
    ) {
      throw new Error("TokenU API key credential identity is immutable");
    }

    this.database
      .prepare(
        `INSERT INTO tokenu_api_keys (
           id,
           name,
           key_prefix,
           key_hash,
           created_at,
           expires_at,
           revoked_at,
           last_used_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           expires_at = excluded.expires_at,
           revoked_at = excluded.revoked_at,
           last_used_at = excluded.last_used_at`
      )
      .run(
        apiKey.id,
        apiKey.name,
        apiKey.keyPrefix,
        apiKey.keyHash,
        existing?.createdAt ?? createdAt,
        expiresAt,
        revokedAt,
        lastUsedAt
      );
  }
}
