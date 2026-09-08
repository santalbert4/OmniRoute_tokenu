import type { ProviderPricing } from "@/tokenu/contracts/providerPricing";

export interface ProviderPricingRepository {
  save(pricing: ProviderPricing): Promise<void>;

  list(): Promise<readonly ProviderPricing[]>;

  find(providerId: string, modelId: string): Promise<ProviderPricing | null>;
}
