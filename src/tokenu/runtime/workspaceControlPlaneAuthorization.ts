import type {
  AuthorizedWorkspaceContext,
  TokenUControlPlaneAction,
  TokenUWorkspaceRole,
} from "@/tokenu/contracts/humanControlPlaneIdentity";

export function canWorkspaceRolePerformAction(
  role: TokenUWorkspaceRole,
  action: TokenUControlPlaneAction
): boolean {
  switch (action) {
    case "manage_api_keys":
      return role === "owner" || role === "admin";
  }
}

/**
 * Converts already-authenticated membership context into an action-authorized
 * workspace context.
 *
 * Authentication itself deliberately remains outside this policy.
 */
export function requireWorkspaceControlPlaneAction(
  context: AuthorizedWorkspaceContext,
  action: TokenUControlPlaneAction
): AuthorizedWorkspaceContext {
  if (!canWorkspaceRolePerformAction(context.role, action)) {
    throw new Error("TokenU workspace action forbidden");
  }

  return context;
}
