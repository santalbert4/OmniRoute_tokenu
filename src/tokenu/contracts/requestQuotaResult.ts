export interface RequestQuotaResult {
  readonly allowed: boolean;

  readonly remainingRequests: number;

  readonly reason: string | null;
}
