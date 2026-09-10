import type { TokenUHumanSession } from "@/tokenu/contracts/humanSession";

export interface HumanSessionRepository {
  get(sessionId: string): Promise<TokenUHumanSession | null>;

  /**
   * Creates one new immutable server-side human authentication session.
   */
  create(session: TokenUHumanSession): Promise<void>;

  /**
   * Revokes one session monotonically.
   *
   * Returns false when the session does not exist. Implementations must never
   * clear or rewrite an existing revocation timestamp.
   */
  revoke(sessionId: string, revokedAt: string): Promise<boolean>;
}
