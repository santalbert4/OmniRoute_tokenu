export interface UsageSummary {
  readonly requestCount: number;

  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly totalTokens: number;

  readonly byProvider: Readonly<Record<string, number>>;
  readonly byModel: Readonly<Record<string, number>>;
}
