/**
 * Server-side TokenU human authentication session.
 *
 * The raw bearer secret is never persisted in this contract. Workspace
 * authorization remains a separate P8B concern.
 */
export interface TokenUHumanSession {
  readonly id: string;
  readonly userId: string;
  readonly secretHash: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
}

/**
 * Result returned only when a new human session is created.
 *
 * The credential contains the raw bearer secret and must be delivered to the
 * web transport without persisting it.
 */
export interface CreatedHumanSession {
  readonly session: TokenUHumanSession;
  readonly credential: string;
}
