import type {
  ProviderCredentialKind,
  TokenUProviderConnection,
} from "@/tokenu/contracts/providerConnection";
import type { CredentialCipher } from "@/tokenu/runtime/credentialCipher";
import type { ProviderConnectionRepository } from "@/tokenu/runtime/providerConnectionRepository";

export interface SaveManagedProviderCredentialInput {
  readonly connectionId: string;
  readonly providerId: string;
  readonly credentialKind: ProviderCredentialKind;
  readonly plaintextCredential: string;
  readonly enabled: boolean;
  readonly recordedAt: string;
}

/**
 * Trusted write boundary for TokenU-managed provider credentials.
 *
 * Plain credential material is encrypted before reaching persistence.
 */
export class ProviderConnectionService {
  constructor(
    private readonly repository: ProviderConnectionRepository,
    private readonly cipher: CredentialCipher
  ) {}

  async saveManagedCredential(input: SaveManagedProviderCredentialInput): Promise<void> {
    if (!input.connectionId.trim()) {
      throw new Error("TokenU managed credential requires connection identity");
    }

    if (!input.providerId.trim()) {
      throw new Error("TokenU managed credential requires provider identity");
    }

    if (!input.plaintextCredential.trim()) {
      throw new Error("TokenU managed credential requires secret material");
    }

    const recordedAt = new Date(input.recordedAt);

    if (Number.isNaN(recordedAt.getTime())) {
      throw new Error("Invalid TokenU managed credential timestamp");
    }

    const existing = await this.repository.get(input.connectionId);

    const context = {
      connectionId: input.connectionId,
      providerId: input.providerId,
      credentialMode: "TOKENU_MANAGED" as const,
      credentialKind: input.credentialKind,
    };

    const encryptedCredential = this.cipher.encrypt(input.plaintextCredential, context);

    const timestamp = recordedAt.toISOString();

    const connection: TokenUProviderConnection = {
      id: input.connectionId,
      providerId: input.providerId,
      credentialMode: "TOKENU_MANAGED",
      credentialKind: input.credentialKind,
      encryptedCredential,
      enabled: input.enabled,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    await this.repository.save(connection);
  }
}
