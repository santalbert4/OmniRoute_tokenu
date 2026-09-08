import type { ExecutionUsageRecord } from "@/tokenu/contracts/executionUsageRecord";
import type { ExecutionCost } from "@/tokenu/contracts/executionCost";
import type { ProviderPricingRepository } from "@/tokenu/runtime/providerPricingRepository";

export class ExecutionCostCalculator {
  constructor(private readonly pricingRepository: ProviderPricingRepository) {}

  async calculate(record: ExecutionUsageRecord): Promise<ExecutionCost | null> {
    const pricing = await this.pricingRepository.find(record.providerId, record.modelId);

    if (!pricing) {
      return null;
    }

    const inputCost =
      ((record.usage.inputTokens ?? 0) / 1_000_000) * pricing.inputTokenPricePerMillion;

    const outputCost =
      ((record.usage.outputTokens ?? 0) / 1_000_000) * pricing.outputTokenPricePerMillion;

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
