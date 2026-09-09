import type { CredentialCipher } from "@/tokenu/runtime/credentialCipher";
import type { ProviderConnectionRepository } from "@/tokenu/runtime/providerConnectionRepository";
import type { ResolvedCredential, SecretResolver } from "@/tokenu/runtime/secretResolver";

/**
 * Resolves one exact persistent TokenU-managed connection.
 *
 * No provider discovery, key rotation, fallback or environment lookup occurs.
 */
export class PersistentSecretResolver implements SecretResolver {
  constructor(
    private readonly repository: ProviderConnectionRepository,
    private readonly cipher: CredentialCipher
  ) {}

  async resolve(connectionId: string): Promise<ResolvedCredential | null> {
    if (!connectionId.trim()) {
      return null;
    }

    const connection = await this.repository.get(connectionId);

    if (!connection || !connection.enabled || connection.credentialMode !== "TOKENU_MANAGED") {
      return null;
    }

    const value = this.cipher.decrypt(connection.encryptedCredential, {
      connectionId: connection.id,
      providerId: connection.providerId,
      credentialMode: connection.credentialMode,
      credentialKind: connection.credentialKind,
    });

    if (!value?.trim()) {
      return null;
    }

    return {
      kind: connection.credentialKind,
      value,
    };
  }
}
