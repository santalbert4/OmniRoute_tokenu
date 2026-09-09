import type { TokenUWorkspace } from "@/tokenu/contracts/workspaceIdentity";

export interface WorkspaceRepository {
  get(workspaceId: string): Promise<TokenUWorkspace | null>;

  save(workspace: TokenUWorkspace): Promise<void>;
}
