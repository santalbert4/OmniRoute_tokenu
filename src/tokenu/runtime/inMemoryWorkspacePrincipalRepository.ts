import type {
  TokenUPrincipalType,
  TokenUWorkspacePrincipal,
} from "@/tokenu/contracts/workspaceIdentity";
import type { WorkspacePrincipalRepository } from "@/tokenu/runtime/workspacePrincipalRepository";

export class InMemoryWorkspacePrincipalRepository implements WorkspacePrincipalRepository {
  private readonly bindings = new Map<string, TokenUWorkspacePrincipal>();

  async get(
    principalType: TokenUPrincipalType,
    principalId: string
  ): Promise<TokenUWorkspacePrincipal | null> {
    return this.bindings.get(this.key(principalType, principalId)) ?? null;
  }

  async listByWorkspace(workspaceId: string): Promise<readonly TokenUWorkspacePrincipal[]> {
    if (!workspaceId.trim()) {
      return [];
    }

    return [...this.bindings.values()]
      .filter((binding) => binding.workspaceId === workspaceId)
      .sort(
        (left, right) =>
          left.assignedAt.localeCompare(right.assignedAt) ||
          left.principalType.localeCompare(right.principalType) ||
          left.principalId.localeCompare(right.principalId)
      );
  }

  async save(binding: TokenUWorkspacePrincipal): Promise<void> {
    const key = this.key(binding.principalType, binding.principalId);

    const existing = this.bindings.get(key);

    if (existing && existing.workspaceId !== binding.workspaceId) {
      throw new Error("TokenU principal already assigned to another workspace");
    }

    this.bindings.set(key, existing ?? binding);
  }

  private key(principalType: TokenUPrincipalType, principalId: string): string {
    return `${principalType}:${principalId}`;
  }
}
