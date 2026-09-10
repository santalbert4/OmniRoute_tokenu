import type { TokenUUser } from "@/tokenu/contracts/humanControlPlaneIdentity";
import type { TokenUUserRepository } from "@/tokenu/runtime/tokenUUserRepository";

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`TokenU user requires ${label}`);
  }
}

export class InMemoryTokenUUserRepository implements TokenUUserRepository {
  private readonly users = new Map<string, TokenUUser>();

  async get(userId: string): Promise<TokenUUser | null> {
    if (!userId.trim()) {
      return null;
    }

    return this.users.get(userId) ?? null;
  }

  async save(user: TokenUUser): Promise<void> {
    requireNonBlank(user.id, "identity");
    requireNonBlank(user.createdAt, "creation timestamp");

    const existing = this.users.get(user.id);

    if (existing) {
      if (existing.createdAt !== user.createdAt) {
        throw new Error("TokenU user identity is immutable");
      }

      return;
    }

    this.users.set(user.id, user);
  }
}
