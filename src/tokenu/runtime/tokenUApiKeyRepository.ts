import type { TokenUApiKey } from "@/tokenu/contracts/tokenUApiKey";

export interface TokenUApiKeyRepository {
  getById(apiKeyId: string): Promise<TokenUApiKey | null>;

  getByHash(keyHash: string): Promise<TokenUApiKey | null>;

  /**
   * Best-effort analytical metadata write.
   *
   * Implementations must update only lastUsedAt and must never rewrite
   * credential identity or lifecycle state.
   */
  touchLastUsedAt(apiKeyId: string, usedAt: string): Promise<void>;

  save(apiKey: TokenUApiKey): Promise<void>;
}
