import type { WorkspaceRequestUsage } from "@/tokenu/contracts/workspaceRequestUsage";
import type { WorkspaceRequestUsageRepository } from "@/tokenu/runtime/workspaceRequestUsageRepository";

export class InMemoryWorkspaceRequestUsageRepository implements WorkspaceRequestUsageRepository {
  private readonly usage = new Map<string, WorkspaceRequestUsage>();

  async get(workspaceId: string, period: string): Promise<WorkspaceRequestUsage | null> {
    const key = `${workspaceId}:${period}`;

    return this.usage.get(key) ?? null;
  }

  async increment(workspaceId: string, period: string): Promise<void> {
    const key = `${workspaceId}:${period}`;

    const current = this.usage.get(key);

    this.usage.set(key, {
      workspaceId,

      period,

      requestCount: (current?.requestCount ?? 0) + 1,
    });
  }
}
