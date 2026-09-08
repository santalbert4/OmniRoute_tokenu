import type { ExecutionUsageRecord } from "@/tokenu/contracts/executionUsageRecord";
import type { ExecutionCostCalculator } from "@/tokenu/runtime/executionCostCalculator";
import type { CostLedgerRepository } from "@/tokenu/runtime/costLedgerRepository";
import type { CostLedgerRecordResult } from "@/tokenu/contracts/costLedgerRecordResult";

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
  ): Promise<CostLedgerRecordResult> {
    const cost = await this.costCalculator.calculate(record);

    if (!cost) {
      return {
        recorded: false,
        cost: 0,
        entryId: record.id,
      };
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

    return {
      recorded: true,
      cost: cost.totalCost,
      entryId: record.id,
    };
  }
}
