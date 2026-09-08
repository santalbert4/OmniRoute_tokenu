import type { WorkspaceUsageMeteringRepository } from "@/tokenu/runtime/workspaceUsageMeteringRepository";

export class WorkspaceUsageMeteringService {
  constructor(private readonly repository: WorkspaceUsageMeteringRepository) {}

  async record(
    workspaceId: string,
    period: string,
    inputTokens: number,
    outputTokens: number,
    estimatedCost: number
  ): Promise<void> {
    const existing = await this.repository.get(workspaceId, period);

    await this.repository.save({
      workspaceId,

      period,

      meteredExecutionCount: (existing?.meteredExecutionCount ?? 0) + 1,

      inputTokens: (existing?.inputTokens ?? 0) + inputTokens,

      outputTokens: (existing?.outputTokens ?? 0) + outputTokens,

      estimatedCost: Number(((existing?.estimatedCost ?? 0) + estimatedCost).toFixed(6)),
    });
  }
}
