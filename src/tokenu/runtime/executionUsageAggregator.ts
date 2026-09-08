import type { ExecutionUsageRecord } from "@/tokenu/contracts/executionUsageRecord";
import type { UsageSummary } from "@/tokenu/contracts/usageSummary";

export class ExecutionUsageAggregator {
  aggregate(records: readonly ExecutionUsageRecord[]): UsageSummary {
    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;

    for (const record of records) {
      const input = record.usage.inputTokens ?? 0;

      const output = record.usage.outputTokens ?? 0;

      const total = record.usage.totalTokens ?? input + output;

      totalInputTokens += input;
      totalOutputTokens += output;
      totalTokens += total;

      byProvider[record.providerId] = (byProvider[record.providerId] ?? 0) + total;

      byModel[record.modelId] = (byModel[record.modelId] ?? 0) + total;
    }

    return {
      requestCount: records.length,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      byProvider,
      byModel,
    };
  }
}
