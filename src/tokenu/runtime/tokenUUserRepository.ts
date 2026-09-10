import type { TokenUUser } from "@/tokenu/contracts/humanControlPlaneIdentity";

export interface TokenUUserRepository {
  get(userId: string): Promise<TokenUUser | null>;

  /**
   * Persists one immutable TokenU-owned user identity.
   *
   * Re-saving the exact same identity is idempotent. Reusing an existing id
   * with different immutable metadata must fail rather than silently retarget
   * the identity.
   */
  save(user: TokenUUser): Promise<void>;
}
