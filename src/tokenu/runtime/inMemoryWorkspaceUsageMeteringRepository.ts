import type { WorkspaceUsageMetering } from "@/tokenu/contracts/workspaceUsageMetering";
import type {
  WorkspaceUsageMeteringIncrement,
  WorkspaceUsageMeteringRepository,
} from "@/tokenu/runtime/workspaceUsageMeteringRepository";

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

  async increment(
    workspaceId: string,
    period: string,
    delta: WorkspaceUsageMeteringIncrement
  ): Promise<void> {
    const key = `${workspaceId}:${period}`;

    const existing = this.usage.get(key);

    this.usage.set(key, {
      workspaceId,
      period,
      meteredExecutionCount: (existing?.meteredExecutionCount ?? 0) + 1,
      inputTokens: (existing?.inputTokens ?? 0) + delta.inputTokens,
      outputTokens: (existing?.outputTokens ?? 0) + delta.outputTokens,
      estimatedCost: Number(((existing?.estimatedCost ?? 0) + delta.estimatedCost).toFixed(6)),
    });
  }
}
