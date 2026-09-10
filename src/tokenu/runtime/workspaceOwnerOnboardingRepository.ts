import type { TokenUUser } from "@/tokenu/contracts/humanControlPlaneIdentity";
import type { TokenUWorkspace } from "@/tokenu/contracts/workspaceIdentity";

export interface ProvisionWorkspaceOwnerInput {
  readonly workspace: TokenUWorkspace;

  readonly owner: TokenUUser;

  readonly membershipCreatedAt: string;
}

/**
 * Atomic persistence boundary for creating a brand-new TokenU workspace with
 * its initial human owner.
 *
 * An existing workspace is deliberately not adopted by this primitive.
 */
export interface WorkspaceOwnerOnboardingRepository {
  provision(input: ProvisionWorkspaceOwnerInput): Promise<void>;
}
