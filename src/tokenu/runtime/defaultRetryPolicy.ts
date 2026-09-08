import type { CoreExecutionResult } from "@/tokenu/contracts/coreExecutionResult";
import type { RetryDecision, RetryPolicy } from "@/tokenu/contracts/retryPolicy";

export class DefaultRetryPolicy implements RetryPolicy {
  evaluate(result: CoreExecutionResult, remainingAttempts: number): RetryDecision {
    if (result.status === "succeeded") {
      return {
        retry: false,
        reason: "execution-succeeded",
      };
    }

    if (result.retryability === "not-retryable") {
      return {
        retry: false,
        reason: "result-not-retryable",
      };
    }

    if (remainingAttempts <= 0) {
      return {
        retry: false,
        reason: "no-attempts-remaining",
      };
    }

    return {
      retry: true,
      reason: "retryable-failure",
    };
  }
}
