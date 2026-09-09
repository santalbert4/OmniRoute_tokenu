export type TokenUPrincipalType = "api_key";

export interface TokenUWorkspace {
  readonly id: string;

  readonly createdAt: string;
}

export interface TokenUWorkspacePrincipal {
  readonly workspaceId: string;

  readonly principalType: TokenUPrincipalType;

  readonly principalId: string;

  readonly assignedAt: string;
}
