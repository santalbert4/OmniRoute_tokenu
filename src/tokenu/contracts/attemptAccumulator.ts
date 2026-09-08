import type { NormalizedExecutionError, Retryability } from "@/tokenu/contracts/executionError";
import type { CoreExecutionStatus, InterruptionStatus } from "@/tokenu/contracts/executionState";
import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";
import type { NormalizedUsage } from "@/tokenu/contracts/usage";

export interface AttemptAccumulatorTiming {
  readonly startedAt: string;
  timeToFirstByteMs: number | null;
}

/**
 * Lifecycle state for one upstream attempt.
 *
 * The whole lifecycle object is replaced atomically as execution progresses,
 * preventing impossible combinations of terminal status, timing and error.
 */
export type AttemptAccumulatorLifecycle =
  | {
      readonly status: "running";
      readonly completedAt: null;
      readonly durationMs: null;
      readonly error: null;
      readonly retryability: "unknown";
      readonly interruption: "none";
    }
  | {
      readonly status: "succeeded";
      readonly completedAt: string;
      readonly durationMs: number;
      readonly error: null;
      readonly retryability: "not-retryable";
      readonly interruption: "none";
    }
  | {
      readonly status: Exclude<CoreExecutionStatus, "succeeded">;
      readonly completedAt: string;
      readonly durationMs: number;
      readonly error: NormalizedExecutionError;
      readonly retryability: Retryability;
      readonly interruption: InterruptionStatus;
    };

/**
 * Mutable execution-result accumulator for exactly one upstream attempt.
 *
 * Protocol-specific parser state must not be stored here. This object only
 * accumulates execution-level facts required to build CoreExecutionResult
 * and technical telemetry for one attemptId.
 */
export interface AttemptAccumulator {
  readonly requestId: string;
  readonly attemptId: string;
  readonly target: ExecutionTarget;

  accumulatedContent: string;
  accumulatedReasoning: string;

  normalizedUsage: NormalizedUsage;
  timing: AttemptAccumulatorTiming;
  lifecycle: AttemptAccumulatorLifecycle;
}
