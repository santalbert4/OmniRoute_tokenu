import type { CostLedgerRecordResult } from "@/tokenu/contracts/costLedgerRecordResult";
import type { ExecutionUsageRecord } from "@/tokenu/contracts/executionUsageRecord";
import type { CostLedgerRepository } from "@/tokenu/runtime/costLedgerRepository";
import type { ExecutionCostCalculator } from "@/tokenu/runtime/executionCostCalculator";

export class CostLedgerService {
  constructor(
    private readonly costCalculator: ExecutionCostCalculator,
    private readonly ledgerRepository: CostLedgerRepository
  ) {}

  async recordExecution(
    record: ExecutionUsageRecord & {
      workspaceId: string;
    }
  ): Promise<CostLedgerRecordResult> {
    const cost = await this.costCalculator.calculate(record);

    if (!cost) {
      return {
        recorded: false,
        cost: 0,
        entryId: record.attemptId,
      };
    }

    const recorded = await this.ledgerRepository.append({
      workspaceId: record.workspaceId,
      requestId: record.requestId,
      attemptId: record.attemptId,
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
      recorded,
      cost: recorded ? cost.totalCost : 0,
      entryId: record.attemptId,
    };
  }
}
