import type { ExecutionUsageRecord } from "@/tokenu/contracts/executionUsageRecord";
import type { ExecutionCostCalculator } from "@/tokenu/runtime/executionCostCalculator";
import type { CostLedgerRepository } from "@/tokenu/runtime/costLedgerRepository";

export class CostLedgerService {
  constructor(
    private readonly costCalculator: ExecutionCostCalculator,
    private readonly ledgerRepository: CostLedgerRepository
  ) {}

  async recordExecution(
    record: ExecutionUsageRecord & {
      workspaceId: string;
      id: string;
    }
  ): Promise<void> {
    const cost = await this.costCalculator.calculate(record);

    if (!cost) {
      return;
    }

    await this.ledgerRepository.append({
      id: record.id,
      workspaceId: record.workspaceId,
      requestId: record.requestId,
      providerId: cost.providerId,
      modelId: cost.modelId,
      currency: cost.currency,
      inputTokens: record.usage.inputTokens ?? 0,
      outputTokens: record.usage.outputTokens ?? 0,
      totalTokens: record.usage.totalTokens ?? 0,
      cost: cost.totalCost,
      createdAt: record.recordedAt,
    });
  }
}
