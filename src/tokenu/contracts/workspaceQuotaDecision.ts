export interface WorkspaceQuotaDecision {
  readonly allowed: boolean;

  readonly reason: string | null;

  readonly remainingCost: number;

  readonly remainingRequests: number;
}
