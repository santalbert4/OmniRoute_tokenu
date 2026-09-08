export interface BudgetEnforcementResult {
  readonly allowed: boolean;

  readonly remaining: number;

  readonly reason: string | null;
}
