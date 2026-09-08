import type { WorkspaceUsageMetering } from "@/tokenu/contracts/workspaceUsageMetering";
import type { WorkspaceUsageMeteringRepository } from "@/tokenu/runtime/workspaceUsageMeteringRepository";

export class InMemoryWorkspaceUsageMeteringRepository implements WorkspaceUsageMeteringRepository {
  private readonly usage = new Map<string, WorkspaceUsageMetering>();

  async get(workspaceId: string, period: string): Promise<WorkspaceUsageMetering | null> {
    const key = `${workspaceId}:${period}`;

    return this.usage.get(key) ?? null;
  }

  async save(usage: WorkspaceUsageMetering): Promise<void> {
    const key = `${usage.workspaceId}:${usage.period}`;

    this.usage.set(key, usage);
  }
}
