/**
 * Internal TokenU human identity.
 *
 * Authentication-provider identities, email addresses, passwords and session
 * material deliberately do not belong to this contract.
 */
export interface TokenUUser {
  readonly id: string;

  readonly createdAt: string;
}

export type TokenUWorkspaceRole = "owner" | "admin" | "member";

export interface TokenUWorkspaceMembership {
  readonly workspaceId: string;

  readonly userId: string;

  readonly role: TokenUWorkspaceRole;

  readonly createdAt: string;
}

/**
 * Workspace context produced only after an authenticated human identity has
 * passed membership and action authorization.
 *
 * A requested workspace id from a public URL/body is not this context.
 */
export interface AuthorizedWorkspaceContext {
  readonly workspaceId: string;

  readonly userId: string;

  readonly role: TokenUWorkspaceRole;
}

export type TokenUControlPlaneAction = "manage_api_keys";
