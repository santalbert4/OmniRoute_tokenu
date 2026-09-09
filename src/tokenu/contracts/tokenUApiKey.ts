/**
 * Persistent TokenU-owned API-key identity.
 *
 * Raw bearer material is deliberately absent from this contract.
 * Only a non-secret display prefix and deterministic hash may persist.
 */
export interface TokenUApiKey {
  readonly id: string;

  readonly name: string;

  readonly keyPrefix: string;

  readonly keyHash: string;

  readonly createdAt: string;

  readonly expiresAt: string | null;

  readonly revokedAt: string | null;

  readonly lastUsedAt: string | null;
}
