import type {
  TokenUWorkspaceMembership,
  TokenUWorkspaceRole,
} from "@/tokenu/contracts/humanControlPlaneIdentity";

export interface WorkspaceMembershipRepository {
  get(workspaceId: string, userId: string): Promise<TokenUWorkspaceMembership | null>;

  listByUser(userId: string): Promise<readonly TokenUWorkspaceMembership[]>;

  listByWorkspace(workspaceId: string): Promise<readonly TokenUWorkspaceMembership[]>;

  /**
   * Creates one new workspace membership.
   *
   * This operation is deliberately INSERT-only. Existing membership roles
   * must never be changed implicitly by create().
   */
  create(membership: TokenUWorkspaceMembership): Promise<void>;

  /**
   * Changes role for one existing membership.
   *
   * Returns false when the membership does not exist. Persistent final-owner
   * protection remains authoritative in migration 182.
   */
  updateRole(workspaceId: string, userId: string, role: TokenUWorkspaceRole): Promise<boolean>;

  /**
   * Removes one existing membership.
   *
   * Returns false when the membership does not exist. Persistent final-owner
   * protection remains authoritative in migration 182.
   */
  remove(workspaceId: string, userId: string): Promise<boolean>;
}
