import type {
  ProviderCredentialKind,
  TokenUProviderConnection,
} from "@/tokenu/contracts/providerConnection";
import type { ProviderConnectionRepository } from "@/tokenu/runtime/providerConnectionRepository";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";

interface ProviderConnectionRow {
  readonly id: string;
  readonly provider_id: string;
  readonly credential_mode: string;
  readonly credential_kind: ProviderCredentialKind;
  readonly encrypted_credential: string;
  readonly enabled: number;
  readonly created_at: string;
  readonly updated_at: string;
}

function isCredentialKind(value: unknown): value is ProviderCredentialKind {
  return value === "api-key" || value === "oauth-access-token";
}

function isRow(value: unknown): value is ProviderConnectionRow {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Partial<ProviderConnectionRow>;

  return (
    typeof row.id === "string" &&
    row.id.trim().length > 0 &&
    typeof row.provider_id === "string" &&
    row.provider_id.trim().length > 0 &&
    row.credential_mode === "TOKENU_MANAGED" &&
    isCredentialKind(row.credential_kind) &&
    typeof row.encrypted_credential === "string" &&
    row.encrypted_credential.trim().length > 0 &&
    (row.enabled === 0 || row.enabled === 1) &&
    typeof row.created_at === "string" &&
    row.created_at.trim().length > 0 &&
    typeof row.updated_at === "string" &&
    row.updated_at.trim().length > 0
  );
}

function canonicalTimestamp(value: string, label: string): string {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Invalid TokenU provider connection ${label}`);
  }

  return timestamp.toISOString();
}

function toConnection(row: ProviderConnectionRow): TokenUProviderConnection {
  return {
    id: row.id,
    providerId: row.provider_id,
    credentialMode: "TOKENU_MANAGED",
    credentialKind: row.credential_kind,
    encryptedCredential: row.encrypted_credential,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Persistent TokenU-owned provider connection repository.
 *
 * Connection identity is immutable. Reusing one connection id for another
 * provider or credential kind is rejected instead of silently retargeting it.
 */
export class SqliteProviderConnectionRepository implements ProviderConnectionRepository {
  constructor(private readonly database: TokenUSqliteDatabase) {}

  async get(connectionId: string): Promise<TokenUProviderConnection | null> {
    const row = this.database
      .prepare(
        `SELECT
           id,
           provider_id,
           credential_mode,
           credential_kind,
           encrypted_credential,
           enabled,
           created_at,
           updated_at
         FROM tokenu_provider_connections
         WHERE id = ?`
      )
      .get(connectionId);

    if (!row) {
      return null;
    }

    if (!isRow(row)) {
      throw new Error("Invalid TokenU provider connection row");
    }

    return toConnection(row);
  }

  async save(connection: TokenUProviderConnection): Promise<void> {
    if (!connection.id.trim()) {
      throw new Error("TokenU provider connection requires identity");
    }

    if (!connection.providerId.trim()) {
      throw new Error("TokenU provider connection requires provider identity");
    }

    if (!connection.encryptedCredential.trim()) {
      throw new Error("TokenU provider connection requires encrypted credential");
    }

    const createdAt = canonicalTimestamp(connection.createdAt, "created timestamp");

    const updatedAt = canonicalTimestamp(connection.updatedAt, "updated timestamp");

    const transaction = this.database.transaction(() => {
      const existing = this.database
        .prepare(
          `SELECT
               id,
               provider_id,
               credential_mode,
               credential_kind,
               encrypted_credential,
               enabled,
               created_at,
               updated_at
             FROM tokenu_provider_connections
             WHERE id = ?`
        )
        .get(connection.id);

      if (existing) {
        if (!isRow(existing)) {
          throw new Error("Invalid TokenU provider connection row");
        }

        if (
          existing.provider_id !== connection.providerId ||
          existing.credential_mode !== connection.credentialMode ||
          existing.credential_kind !== connection.credentialKind
        ) {
          throw new Error("TokenU provider connection identity is immutable");
        }
      }

      this.database
        .prepare(
          `INSERT INTO tokenu_provider_connections (
               id,
               provider_id,
               credential_mode,
               credential_kind,
               encrypted_credential,
               enabled,
               created_at,
               updated_at
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id)
             DO UPDATE SET
               encrypted_credential =
                 excluded.encrypted_credential,
               enabled =
                 excluded.enabled,
               updated_at =
                 excluded.updated_at`
        )
        .run(
          connection.id,
          connection.providerId,
          connection.credentialMode,
          connection.credentialKind,
          connection.encryptedCredential,
          connection.enabled ? 1 : 0,
          createdAt,
          updatedAt
        );
    });

    transaction();
  }
}
