import type { TokenUApiKey } from "@/tokenu/contracts/tokenUApiKey";
import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type {
  ProvisionWorkspaceApiKeyInput,
  WorkspaceApiKeyProvisioningRepository,
} from "@/tokenu/runtime/workspaceApiKeyProvisioningRepository";

function normalizeTimestamp(value: string, fieldName: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid TokenU workspace API key ${fieldName}`);
  }

  return parsed.toISOString();
}

function normalizeOptionalTimestamp(value: string | null, fieldName: string): string | null {
  return value === null ? null : normalizeTimestamp(value, fieldName);
}

function validateApiKey(apiKey: TokenUApiKey): void {
  if (!apiKey.id.trim()) {
    throw new Error("TokenU workspace API key requires credential identity");
  }

  if (!apiKey.name.trim()) {
    throw new Error("TokenU workspace API key requires name");
  }

  if (!apiKey.keyPrefix.trim()) {
    throw new Error("TokenU workspace API key requires display prefix");
  }

  if (!/^[0-9a-f]{64}$/.test(apiKey.keyHash)) {
    throw new Error("TokenU workspace API key requires lowercase SHA-256 hash");
  }
}

export class SqliteWorkspaceApiKeyProvisioningRepository implements WorkspaceApiKeyProvisioningRepository {
  constructor(private readonly database: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async provision(input: ProvisionWorkspaceApiKeyInput): Promise<void> {
    const workspaceId = input.workspaceId.trim();

    if (!workspaceId) {
      throw new Error("TokenU workspace API-key provisioning requires workspace identity");
    }

    validateApiKey(input.apiKey);

    const createdAt = normalizeTimestamp(input.apiKey.createdAt, "createdAt");

    const expiresAt = normalizeOptionalTimestamp(input.apiKey.expiresAt, "expiresAt");

    const revokedAt = normalizeOptionalTimestamp(input.apiKey.revokedAt, "revokedAt");

    const lastUsedAt = normalizeOptionalTimestamp(input.apiKey.lastUsedAt, "lastUsedAt");

    const assignedAt = normalizeTimestamp(input.assignedAt, "assignedAt");

    if (typeof this.database.transaction !== "function") {
      throw new Error("TokenU SQLite database does not support atomic transactions");
    }

    const transaction = this.database.transaction(() => {
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
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.apiKey.id,
          input.apiKey.name,
          input.apiKey.keyPrefix,
          input.apiKey.keyHash,
          createdAt,
          expiresAt,
          revokedAt,
          lastUsedAt
        );

      this.database
        .prepare(
          `INSERT INTO tokenu_workspace_principals (
               workspace_id,
               principal_type,
               principal_id,
               assigned_at
             )
             VALUES (?, 'api_key', ?, ?)`
        )
        .run(workspaceId, input.apiKey.id, assignedAt);
    });

    transaction();
  }
}
