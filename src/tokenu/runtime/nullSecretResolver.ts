import type { ResolvedCredential, SecretResolver } from "@/tokenu/runtime/secretResolver";

/**
 * Production-safe default until TokenU persistent credential storage is wired.
 *
 * It intentionally resolves no credential. This prevents runtime composition
 * from silently falling back to legacy OmniRoute secrets or environment keys.
 */
export class NullSecretResolver implements SecretResolver {
  async resolve(_connectionId: string): Promise<ResolvedCredential | null> {
    return null;
  }
}
