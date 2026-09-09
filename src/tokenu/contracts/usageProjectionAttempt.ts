/**
 * One completed execution attempt projected into persistent analytical usage.
 *
 * This is not the authoritative billing ledger. Cost is an analytical
 * estimate associated with the immutable attempt identity.
 */
export interface UsageProjectionAttempt {
  readonly workspaceId: string;

  readonly requestId: string;

  readonly attemptId: string;

  readonly period: string;

  readonly providerId: string;

  readonly modelId: string;

  readonly inputTokens: number;

  readonly outputTokens: number;

  readonly estimatedCost: number;

  readonly recordedAt: string;
}
