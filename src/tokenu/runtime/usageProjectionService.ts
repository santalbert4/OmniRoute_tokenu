import type { ExecutionUsageRecord } from "@/tokenu/contracts/executionUsageRecord";
import type { ExecutionCostCalculator } from "@/tokenu/runtime/executionCostCalculator";
import type { UsageProjectionRepository } from "@/tokenu/runtime/usageProjectionRepository";

type ExecutionCostCalculatorPort = Pick<ExecutionCostCalculator, "calculate">;

/**
 * Converts completed execution usage into one persistent analytical projection.
 *
 * Billing remains authoritative in CostLedgerService. This service derives only
 * analytical estimated cost and persistent token/provider aggregates.
 */
export class UsageProjectionService {
  constructor(
    private readonly costCalculator: ExecutionCostCalculatorPort,
    private readonly repository: UsageProjectionRepository
  ) {}

  async recordExecution(
    record: ExecutionUsageRecord & {
      readonly workspaceId: string;
    }
  ): Promise<boolean> {
    const timestamp = Date.parse(record.recordedAt);

    if (!Number.isFinite(timestamp)) {
      throw new Error("TokenU usage projection requires a valid recorded timestamp");
    }

    const recordedAt = new Date(timestamp).toISOString();

    const normalizedRecord: ExecutionUsageRecord = {
      requestId: record.requestId,
      attemptId: record.attemptId,
      providerId: record.providerId,
      modelId: record.modelId,
      usage: record.usage,
      recordedAt,
    };

    const cost = await this.costCalculator.calculate(normalizedRecord);

    return this.repository.projectAttempt({
      workspaceId: record.workspaceId,
      requestId: record.requestId,
      attemptId: record.attemptId,
      period: recordedAt.slice(0, 7),
      providerId: record.providerId,
      modelId: record.modelId,
      inputTokens: record.usage.inputTokens ?? 0,
      outputTokens: record.usage.outputTokens ?? 0,
      estimatedCost: cost?.totalCost ?? 0,
      recordedAt,
    });
  }
}
