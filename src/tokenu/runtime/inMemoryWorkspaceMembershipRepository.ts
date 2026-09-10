import type {
  TokenUWorkspaceMembership,
  TokenUWorkspaceRole,
} from "@/tokenu/contracts/humanControlPlaneIdentity";
import type { WorkspaceMembershipRepository } from "@/tokenu/runtime/workspaceMembershipRepository";

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`TokenU workspace membership requires ${label}`);
  }
}

function isWorkspaceRole(value: unknown): value is TokenUWorkspaceRole {
  return value === "owner" || value === "admin" || value === "member";
}

function requireWorkspaceRole(role: TokenUWorkspaceRole): void {
  if (!isWorkspaceRole(role)) {
    throw new Error("Invalid TokenU workspace membership role");
  }
}

export class InMemoryWorkspaceMembershipRepository implements WorkspaceMembershipRepository {
  private readonly memberships = new Map<string, TokenUWorkspaceMembership>();

  async get(workspaceId: string, userId: string): Promise<TokenUWorkspaceMembership | null> {
    if (!workspaceId.trim() || !userId.trim()) {
      return null;
    }

    return this.memberships.get(this.key(workspaceId, userId)) ?? null;
  }

  async listByUser(userId: string): Promise<readonly TokenUWorkspaceMembership[]> {
    if (!userId.trim()) {
      return [];
    }

    return [...this.memberships.values()]
      .filter((membership) => membership.userId === userId)
      .sort((left, right) => left.workspaceId.localeCompare(right.workspaceId));
  }

  async listByWorkspace(workspaceId: string): Promise<readonly TokenUWorkspaceMembership[]> {
    if (!workspaceId.trim()) {
      return [];
    }

    return [...this.memberships.values()]
      .filter((membership) => membership.workspaceId === workspaceId)
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.userId.localeCompare(right.userId)
      );
  }

  async create(membership: TokenUWorkspaceMembership): Promise<void> {
    requireNonBlank(membership.workspaceId, "workspace identity");
    requireNonBlank(membership.userId, "user identity");
    requireNonBlank(membership.createdAt, "creation timestamp");
    requireWorkspaceRole(membership.role);

    const key = this.key(membership.workspaceId, membership.userId);

    if (this.memberships.has(key)) {
      throw new Error("TokenU workspace membership already exists");
    }

    const hasOwner = [...this.memberships.values()].some(
      (existing) => existing.workspaceId === membership.workspaceId && existing.role === "owner"
    );

    if (!hasOwner && membership.role !== "owner") {
      throw new Error("TokenU workspace requires owner");
    }

    this.memberships.set(key, membership);
  }

  async updateRole(
    workspaceId: string,
    userId: string,
    role: TokenUWorkspaceRole
  ): Promise<boolean> {
    if (!workspaceId.trim() || !userId.trim()) {
      return false;
    }

    requireWorkspaceRole(role);

    const key = this.key(workspaceId, userId);
    const existing = this.memberships.get(key);

    if (!existing) {
      return false;
    }

    if (existing.role === "owner" && role !== "owner" && !this.hasOtherOwner(workspaceId, userId)) {
      throw new Error("TokenU workspace requires owner");
    }

    this.memberships.set(key, {
      ...existing,
      role,
    });

    return true;
  }

  async remove(workspaceId: string, userId: string): Promise<boolean> {
    if (!workspaceId.trim() || !userId.trim()) {
      return false;
    }

    const key = this.key(workspaceId, userId);
    const existing = this.memberships.get(key);

    if (!existing) {
      return false;
    }

    if (existing.role === "owner" && !this.hasOtherOwner(workspaceId, userId)) {
      throw new Error("TokenU workspace requires owner");
    }

    this.memberships.delete(key);

    return true;
  }

  private hasOtherOwner(workspaceId: string, userId: string): boolean {
    return [...this.memberships.values()].some(
      (membership) =>
        membership.workspaceId === workspaceId &&
        membership.userId !== userId &&
        membership.role === "owner"
    );
  }

  private key(workspaceId: string, userId: string): string {
    return `${workspaceId}:${userId}`;
  }
}
