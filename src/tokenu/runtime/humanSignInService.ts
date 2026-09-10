import type { ExternalHumanIdentity } from "@/tokenu/contracts/humanAuthenticationIdentity";
import type { CreatedHumanSession } from "@/tokenu/contracts/humanSession";
import type { HumanAuthenticationIdentityService } from "@/tokenu/runtime/humanAuthenticationIdentityService";
import type { HumanSessionService } from "@/tokenu/runtime/humanSessionService";

export interface HumanSignInInput {
  readonly externalIdentity: ExternalHumanIdentity;
  readonly expiresAt: string;
  readonly createdAt?: string;
}

type HumanIdentityResolver = Pick<HumanAuthenticationIdentityService, "resolve">;
type HumanSessionCreator = Pick<HumanSessionService, "create">;

/**
 * Composes an already verified external human identity with TokenU's internal
 * authentication identity boundary and server-side session boundary.
 *
 * It performs no provisioning, workspace authorization, credential
 * verification, or web transport handling.
 */
export class HumanSignInService {
  constructor(
    private readonly identityResolver: HumanIdentityResolver,
    private readonly sessionCreator: HumanSessionCreator
  ) {}

  async signIn(input: HumanSignInInput): Promise<CreatedHumanSession | null> {
    const authenticatedUser = await this.identityResolver.resolve(input.externalIdentity);

    if (!authenticatedUser) {
      return null;
    }

    if (input.createdAt === undefined) {
      return this.sessionCreator.create({
        userId: authenticatedUser.userId,
        expiresAt: input.expiresAt,
      });
    }

    return this.sessionCreator.create({
      userId: authenticatedUser.userId,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
    });
  }
}
