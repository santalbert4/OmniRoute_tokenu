import type { ProviderPricing } from "@/tokenu/contracts/providerPricing";
import type { ProviderPricingRepository } from "@/tokenu/runtime/providerPricingRepository";

export class InMemoryProviderPricingRepository implements ProviderPricingRepository {
  private readonly records: ProviderPricing[] = [];

  async save(pricing: ProviderPricing): Promise<void> {
    this.records.push(pricing);
  }

  async list(): Promise<readonly ProviderPricing[]> {
    return this.records;
  }

  async find(providerId: string, modelId: string): Promise<ProviderPricing | null> {
    return (
      this.records.find(
        (record) => record.providerId === providerId && record.modelId === modelId
      ) ?? null
    );
  }
}
