import type { ProviderPricing } from "@/tokenu/contracts/providerPricing";
import type { ProviderPricingRepository } from "@/tokenu/runtime/providerPricingRepository";

function timestamp(value: string): number {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid TokenU pricing timestamp");
  }

  return parsed;
}

export class InMemoryProviderPricingRepository implements ProviderPricingRepository {
  private readonly records: ProviderPricing[] = [];

  async save(pricing: ProviderPricing): Promise<void> {
    timestamp(pricing.effectiveFrom);

    const existingIndex = this.records.findIndex(
      (record) =>
        record.providerId === pricing.providerId &&
        record.modelId === pricing.modelId &&
        record.effectiveFrom === pricing.effectiveFrom
    );

    if (existingIndex >= 0) {
      this.records[existingIndex] = pricing;
      return;
    }

    this.records.push(pricing);
  }

  async list(): Promise<readonly ProviderPricing[]> {
    return [...this.records].sort(
      (a, b) =>
        a.providerId.localeCompare(b.providerId) ||
        a.modelId.localeCompare(b.modelId) ||
        timestamp(a.effectiveFrom) - timestamp(b.effectiveFrom)
    );
  }

  async findEffective(
    providerId: string,
    modelId: string,
    effectiveAt: string
  ): Promise<ProviderPricing | null> {
    const effectiveAtMs = timestamp(effectiveAt);

    return (
      this.records
        .filter(
          (record) =>
            record.providerId === providerId &&
            record.modelId === modelId &&
            timestamp(record.effectiveFrom) <= effectiveAtMs
        )
        .sort((a, b) => timestamp(b.effectiveFrom) - timestamp(a.effectiveFrom))[0] ?? null
    );
  }
}
