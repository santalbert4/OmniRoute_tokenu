export interface UsageBudget {
  readonly workspaceId: string;

  readonly monthlyLimit: number;

  readonly currentSpend: number;

  readonly currency: string;
}
