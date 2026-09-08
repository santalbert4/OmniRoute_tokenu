export interface CostLedgerAnalytics {
  readonly executionCount: number;

  readonly totalCost: number;

  readonly providerRanking: readonly {
    providerId: string;
    cost: number;
  }[];

  readonly modelRanking: readonly {
    modelId: string;
    cost: number;
  }[];
}
