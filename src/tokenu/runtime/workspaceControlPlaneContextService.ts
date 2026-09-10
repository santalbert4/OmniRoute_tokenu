import type {
  AuthorizedWorkspaceContext,
  TokenUControlPlaneAction,
} from "@/tokenu/contracts/humanControlPlaneIdentity";
import type { TokenUUserRepository } from "@/tokenu/runtime/tokenUUserRepository";
import { canWorkspaceRolePerformAction } from "@/tokenu/runtime/workspaceControlPlaneAuthorization";
import type { WorkspaceMembershipRepository } from "@/tokenu/runtime/workspaceMembershipRepository";
import type { WorkspaceRepository } from "@/tokenu/runtime/workspaceRepository";

type TokenUUserLookup = Pick<TokenUUserRepository, "get">;

type WorkspaceLookup = Pick<WorkspaceRepository, "get">;

type WorkspaceMembershipLookup = Pick<WorkspaceMembershipRepository, "get">;

function requireAuthenticatedUserId(authenticatedUserId: string): string {
  if (!authenticatedUserId.trim()) {
    throw new Error("TokenU control-plane authorization requires authenticated user identity");
  }

  return authenticatedUserId;
}

/**
 * Resolves one untrusted requested workspace into an action-authorized TokenU
 * workspace context for an already-authenticated internal TokenU user.
 *
 * Authentication transport and provider identity deliberately remain outside
 * this service.
 */
export class WorkspaceControlPlaneContextService {
  constructor(
    private readonly userRepository: TokenUUserLookup,
    private readonly workspaceRepository: WorkspaceLookup,
    private readonly membershipRepository: WorkspaceMembershipLookup
  ) {}

  async authorize(
    authenticatedUserId: string,
    requestedWorkspaceId: string,
    action: TokenUControlPlaneAction
  ): Promise<AuthorizedWorkspaceContext | null> {
    const userId = requireAuthenticatedUserId(authenticatedUserId);

    if (!requestedWorkspaceId.trim()) {
      return null;
    }

    const membership = await this.membershipRepository.get(requestedWorkspaceId, userId);

    if (membership === null) {
      return null;
    }

    if (membership.workspaceId !== requestedWorkspaceId || membership.userId !== userId) {
      throw new Error("TokenU workspace membership lookup returned mismatched identity");
    }

    const [user, workspace] = await Promise.all([
      this.userRepository.get(membership.userId),
      this.workspaceRepository.get(membership.workspaceId),
    ]);

    if (user === null || user.id !== membership.userId) {
      throw new Error("TokenU workspace membership references missing user identity");
    }

    if (workspace === null || workspace.id !== membership.workspaceId) {
      throw new Error("TokenU workspace membership references missing workspace identity");
    }

    if (!canWorkspaceRolePerformAction(membership.role, action)) {
      return null;
    }

    return {
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      role: membership.role,
    };
  }
}
