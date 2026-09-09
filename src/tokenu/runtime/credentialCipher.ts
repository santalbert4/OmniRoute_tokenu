import type {
  ProviderCredentialKind,
  TokenUManagedCredentialMode,
} from "@/tokenu/contracts/providerConnection";

export interface CredentialCipherContext {
  readonly connectionId: string;
  readonly providerId: string;
  readonly credentialMode: TokenUManagedCredentialMode;
  readonly credentialKind: ProviderCredentialKind;
}

/**
 * Encryption boundary for persistent TokenU credential material.
 *
 * Implementations must never fall back to plaintext.
 */
export interface CredentialCipher {
  encrypt(plaintext: string, context: CredentialCipherContext): string;

  decrypt(ciphertext: string, context: CredentialCipherContext): string | null;
}
