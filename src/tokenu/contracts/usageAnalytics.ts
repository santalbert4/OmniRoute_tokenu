export interface UsageAnalytics {
  readonly totalRequests: number;

  readonly totalTokens: number;

  readonly averageTokensPerRequest: number;

  readonly providerRanking: readonly {
    providerId: string;
    tokens: number;
  }[];

  readonly modelRanking: readonly {
    modelId: string;
    tokens: number;
  }[];
}
