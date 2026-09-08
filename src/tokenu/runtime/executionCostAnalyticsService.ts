import type { ExecutionCost } from "@/tokenu/contracts/executionCost";
import type { CostAnalytics } from "@/tokenu/contracts/costAnalytics";

export class ExecutionCostAnalyticsService {
  analyze(costs: readonly ExecutionCost[]): CostAnalytics {
    const providers = new Map<string, number>();

    const models = new Map<string, number>();

    let totalCost = 0;

    for (const cost of costs) {
      totalCost += cost.totalCost;

      providers.set(cost.providerId, (providers.get(cost.providerId) ?? 0) + cost.totalCost);

      models.set(cost.modelId, (models.get(cost.modelId) ?? 0) + cost.totalCost);
    }

    return {
      executionCount: costs.length,

      totalCost,

      averageCostPerExecution: costs.length === 0 ? 0 : totalCost / costs.length,

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
