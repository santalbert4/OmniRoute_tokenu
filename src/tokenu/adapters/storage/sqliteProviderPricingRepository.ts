import type { ProviderPricing } from "@/tokenu/contracts/providerPricing";
import type { ProviderPricingRepository } from "@/tokenu/runtime/providerPricingRepository";

export class SqliteProviderPricingRepository implements ProviderPricingRepository {
  async save(_pricing: ProviderPricing): Promise<void> {
    throw new Error("SQLite provider pricing repository not configured");
  }

  async list(): Promise<readonly ProviderPricing[]> {
    throw new Error("SQLite provider pricing repository not configured");
  }

  async find(_providerId: string, _modelId: string): Promise<ProviderPricing | null> {
    throw new Error("SQLite provider pricing repository not configured");
  }
}
