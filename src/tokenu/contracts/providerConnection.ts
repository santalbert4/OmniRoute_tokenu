/**
 * P6H persistent provider connections are TokenU-managed only.
 *
 * Workspace-scoped HOSTED_BYOK must use a tenant-aware store and must not be
 * added to this global connection contract.
 */
export type TokenUManagedCredentialMode = "TOKENU_MANAGED";

export type ProviderCredentialKind = "api-key" | "oauth-access-token";

/**
 * Persistent encrypted provider connection.
 *
 * encryptedCredential is ciphertext only. Plain credential material must
 * never be stored in this contract.
 */
export interface TokenUProviderConnection {
  readonly id: string;
  readonly providerId: string;
  readonly credentialMode: TokenUManagedCredentialMode;
  readonly credentialKind: ProviderCredentialKind;
  readonly encryptedCredential: string;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
