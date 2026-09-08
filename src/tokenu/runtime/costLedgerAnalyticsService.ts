import type { CostLedgerEntry } from "@/tokenu/contracts/costLedgerEntry";
import type { CostLedgerAnalytics } from "@/tokenu/contracts/costLedgerAnalytics";

export class CostLedgerAnalyticsService {
  analyze(entries: readonly CostLedgerEntry[]): CostLedgerAnalytics {
    const providers = new Map<string, number>();

    const models = new Map<string, number>();

    let totalCost = 0;

    for (const entry of entries) {
      totalCost += entry.cost;

      providers.set(entry.providerId, (providers.get(entry.providerId) ?? 0) + entry.cost);

      models.set(entry.modelId, (models.get(entry.modelId) ?? 0) + entry.cost);
    }

    return {
      executionCount: entries.length,

      totalCost,

      providerRanking: [...providers.entries()]
        .map(([providerId, cost]) => ({
          providerId,
          cost,
        }))
        .sort((a, b) => b.cost - a.cost),

      modelRanking: [...models.entries()]
        .map(([modelId, cost]) => ({
          modelId,
          cost,
        }))
        .sort((a, b) => b.cost - a.cost),
    };
  }
}
