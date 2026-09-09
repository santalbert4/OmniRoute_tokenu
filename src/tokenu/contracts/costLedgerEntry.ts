export interface CostLedgerEntry {
  readonly workspaceId: string;

  readonly requestId: string;

  readonly attemptId: string;

  readonly providerId: string;

  readonly modelId: string;

  readonly currency: string;

  readonly inputTokens: number;

  readonly outputTokens: number;

  readonly totalTokens: number;

  readonly cost: number;

  readonly createdAt: string;
}
