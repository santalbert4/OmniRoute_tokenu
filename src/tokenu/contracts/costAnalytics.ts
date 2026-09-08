export interface CostAnalytics {
  readonly executionCount: number;

  readonly totalCost: number;

  readonly averageCostPerExecution: number;

  readonly providerRanking: readonly {
    providerId: string;
    cost: number;
  }[];

  readonly modelRanking: readonly {
    modelId: string;
    cost: number;
  }[];
}
