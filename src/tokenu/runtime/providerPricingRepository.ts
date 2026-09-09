import type { ProviderPricing } from "@/tokenu/contracts/providerPricing";

export interface ProviderPricingRepository {
  save(pricing: ProviderPricing): Promise<void>;

  list(): Promise<readonly ProviderPricing[]>;

  findEffective(
    providerId: string,
    modelId: string,
    effectiveAt: string
  ): Promise<ProviderPricing | null>;
}
