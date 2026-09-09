import type { ExecutionUsageRecord } from "@/tokenu/contracts/executionUsageRecord";
import type { ExecutionCost } from "@/tokenu/contracts/executionCost";
import type { ProviderPricingRepository } from "@/tokenu/runtime/providerPricingRepository";

export class ExecutionCostCalculator {
  constructor(private readonly pricingRepository: ProviderPricingRepository) {}

  async calculate(record: ExecutionUsageRecord): Promise<ExecutionCost | null> {
    const pricing = await this.pricingRepository.findEffective(
      record.providerId,
      record.modelId,
      record.recordedAt
    );

    if (!pricing) {
      return null;
    }

    const inputTokens = record.usage.inputTokens ?? 0;

    const outputTokens = record.usage.outputTokens ?? 0;

    const cacheReadTokens = record.usage.cacheReadTokens;

    const cacheWriteTokens = record.usage.cacheWriteTokens;

    const cacheReadPrice = pricing.cacheReadTokenPricePerMillion ?? null;

    const cacheWritePrice = pricing.cacheWriteTokenPricePerMillion ?? null;

    if (cacheReadPrice !== null && cacheReadTokens === null && inputTokens > 0) {
      return null;
    }

    if (cacheWritePrice !== null && cacheWriteTokens === null && inputTokens > 0) {
      return null;
    }

    if (cacheReadTokens !== null && cacheReadTokens > 0 && cacheReadPrice === null) {
      return null;
    }

    if (cacheWriteTokens !== null && cacheWriteTokens > 0 && cacheWritePrice === null) {
      return null;
    }

    const knownCacheReadTokens = cacheReadTokens ?? 0;

    const knownCacheWriteTokens = cacheWriteTokens ?? 0;

    if (inputTokens === 0 && (knownCacheReadTokens > 0 || knownCacheWriteTokens > 0)) {
      return null;
    }

    const cachedInputTokens = knownCacheReadTokens + knownCacheWriteTokens;

    if (cachedInputTokens > inputTokens) {
      return null;
    }

    const uncachedInputTokens = inputTokens - cachedInputTokens;

    const uncachedInputCost = (uncachedInputTokens / 1_000_000) * pricing.inputTokenPricePerMillion;

    const cacheReadCost = (knownCacheReadTokens / 1_000_000) * (cacheReadPrice ?? 0);

    const cacheWriteCost = (knownCacheWriteTokens / 1_000_000) * (cacheWritePrice ?? 0);

    const inputCost = uncachedInputCost + cacheReadCost + cacheWriteCost;

    const outputCost = (outputTokens / 1_000_000) * pricing.outputTokenPricePerMillion;

    return {
      providerId: record.providerId,
      modelId: record.modelId,
      currency: pricing.currency,
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
    };
  }
}
