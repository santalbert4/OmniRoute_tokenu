import type {
  TokenUPrincipalType,
  TokenUWorkspacePrincipal,
} from "@/tokenu/contracts/workspaceIdentity";

export interface WorkspacePrincipalRepository {
  get(
    principalType: TokenUPrincipalType,
    principalId: string
  ): Promise<TokenUWorkspacePrincipal | null>;

  save(binding: TokenUWorkspacePrincipal): Promise<void>;
}
