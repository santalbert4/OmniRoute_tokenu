import type { CoreExecutionResult } from "@/tokenu/contracts/coreExecutionResult";

export type RetryDecision =
  | {
      readonly retry: true;
      readonly reason: string;
    }
  | {
      readonly retry: false;
      readonly reason: string;
    };

/**
 * Runtime policy deciding whether another planned attempt may execute.
 *
 * This layer does not create targets, modify requests or perform retries.
 * It only evaluates the result of one completed attempt.
 */
export interface RetryPolicy {
  evaluate(result: CoreExecutionResult, remainingAttempts: number): RetryDecision;
}
