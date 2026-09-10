import type {
  AuthenticatedTokenUUser,
  ExternalHumanIdentity,
} from "@/tokenu/contracts/humanAuthenticationIdentity";
import type { HumanIdentityBindingRepository } from "@/tokenu/runtime/humanIdentityBindingRepository";
import type { TokenUUserRepository } from "@/tokenu/runtime/tokenUUserRepository";

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`Human authentication identity requires ${label}`);
  }
}

/**
 * Resolves externally authenticated human identity into TokenU's internal user
 * identity. This service performs authentication identity binding only.
 *
 * It deliberately performs no workspace selection, membership authorization,
 * session handling, credential validation, or automatic provisioning.
 */
export class HumanAuthenticationIdentityService {
  constructor(
    private readonly bindings: HumanIdentityBindingRepository,
    private readonly users: TokenUUserRepository
  ) {}

  async resolve(externalIdentity: ExternalHumanIdentity): Promise<AuthenticatedTokenUUser | null> {
    requireNonBlank(externalIdentity.authority, "authority");
    requireNonBlank(externalIdentity.subject, "subject");

    const binding = await this.bindings.get(externalIdentity.authority, externalIdentity.subject);

    if (!binding) {
      return null;
    }

    if (
      binding.authority !== externalIdentity.authority ||
      binding.subject !== externalIdentity.subject
    ) {
      throw new Error("Human identity binding lookup returned a different external identity");
    }

    requireNonBlank(binding.userId, "bound TokenU user identity");

    if (!binding.createdAt.trim()) {
      throw new Error("Human identity binding requires creation timestamp");
    }

    const user = await this.users.get(binding.userId);

    if (!user) {
      throw new Error("Human identity binding references missing TokenU user");
    }

    if (user.id !== binding.userId) {
      throw new Error("TokenU user lookup returned a different identity");
    }

    return {
      userId: binding.userId,
    };
  }
}
