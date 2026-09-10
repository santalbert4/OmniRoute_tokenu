import type {
  TokenUPrincipalType,
  TokenUWorkspacePrincipal,
} from "@/tokenu/contracts/workspaceIdentity";

export interface WorkspacePrincipalRepository {
  get(
    principalType: TokenUPrincipalType,
    principalId: string
  ): Promise<TokenUWorkspacePrincipal | null>;

  /**
   * Enumerates principals already bound to one trusted TokenU workspace.
   *
   * This is a reverse lookup only. Workspace ownership remains authoritative
   * in tokenu_workspace_principals and is not duplicated into credential
   * records.
   */
  listByWorkspace(workspaceId: string): Promise<readonly TokenUWorkspacePrincipal[]>;

  save(binding: TokenUWorkspacePrincipal): Promise<void>;
}
