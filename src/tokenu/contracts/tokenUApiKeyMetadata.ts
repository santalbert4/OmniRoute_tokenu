export type TokenUApiKeyStatus = "active" | "expired" | "revoked";

/**
 * Safe API-key metadata suitable for a trusted TokenU control-plane service.
 *
 * Credential verification material is deliberately absent.
 */
export interface TokenUApiKeyMetadata {
  readonly id: string;

  readonly name: string;

  readonly keyPrefix: string;

  readonly createdAt: string;

  readonly expiresAt: string | null;

  readonly revokedAt: string | null;

  readonly lastUsedAt: string | null;

  readonly status: TokenUApiKeyStatus;
}
