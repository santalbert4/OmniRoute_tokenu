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
    await this.repository.increment(workspaceId, period, {
      inputTokens,
      outputTokens,
      estimatedCost,
    });
  }
}
