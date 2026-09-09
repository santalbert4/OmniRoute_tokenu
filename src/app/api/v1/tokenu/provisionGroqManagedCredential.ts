import { AesGcmCredentialCipher } from "@/tokenu/adapters/security/aesGcmCredentialCipher";
import { SqliteProviderConnectionRepository } from "@/tokenu/adapters/storage/sqliteProviderConnectionRepository";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import {
  GROQ_MANAGED_CONNECTION_ID,
  GROQ_PROVIDER_ID,
} from "@/tokenu/runtime/productionGroqCatalog";
import { ProviderConnectionService } from "@/tokenu/runtime/providerConnectionService";

export interface ProvisionGroqManagedCredentialInput {
  readonly database: TokenUSqliteDatabase;
  readonly credentialMasterKey: string;
  readonly groqApiKey: string;
  readonly recordedAt?: string;
}

export interface ProvisionGroqManagedCredentialResult {
  readonly connectionId: string;
  readonly providerId: string;
  readonly credentialKind: "api-key";
  readonly enabled: true;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Trusted infrastructure provisioning boundary for TokenU-managed Groq.
 *
 * Secrets enter only as function inputs. The provider API key is encrypted
 * before persistence and is never returned from this function.
 */
export async function provisionGroqManagedCredential(
  input: ProvisionGroqManagedCredentialInput
): Promise<ProvisionGroqManagedCredentialResult> {
  const groqApiKey = input.groqApiKey.trim();

  if (!groqApiKey) {
    throw new Error("TokenU Groq provisioning requires a non-empty provider API key");
  }

  const cipher = new AesGcmCredentialCipher(input.credentialMasterKey);

  const repository = new SqliteProviderConnectionRepository(input.database);

  const service = new ProviderConnectionService(repository, cipher);

  await service.saveManagedCredential({
    connectionId: GROQ_MANAGED_CONNECTION_ID,
    providerId: GROQ_PROVIDER_ID,
    credentialKind: "api-key",
    plaintextCredential: groqApiKey,
    enabled: true,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  });

  const connection = await repository.get(GROQ_MANAGED_CONNECTION_ID);

  if (!connection) {
    throw new Error("TokenU Groq provisioning did not persist the managed connection");
  }

  return {
    connectionId: connection.id,
    providerId: connection.providerId,
    credentialKind: "api-key",
    enabled: true,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}
