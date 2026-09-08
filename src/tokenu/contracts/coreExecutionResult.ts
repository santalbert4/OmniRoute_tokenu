import type { JsonValue } from "@/tokenu/contracts/json";
import type { NormalizedUsage } from "@/tokenu/contracts/usage";
import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";
import type { NormalizedExecutionError, Retryability } from "@/tokenu/contracts/executionError";
import type { CoreExecutionStatus, InterruptionStatus } from "@/tokenu/contracts/executionState";

export interface CoreExecutionTiming {
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly timeToFirstByteMs: number | null;
}

/**
 * Fields shared by every terminal result of one upstream attempt.
 */
export interface CoreExecutionResultBase {
  readonly requestId: string;
  readonly attemptId: string;
  readonly target: ExecutionTarget;

  /**
   * Final translated non-streaming output when one exists.
   *
   * For streaming execution, output may be null because translated chunks are
   * emitted incrementally through the streaming transport.
   */
  readonly output: JsonValue | null;

  readonly usage: NormalizedUsage;
  readonly timing: CoreExecutionTiming;
}

/**
 * Terminal technical result of exactly one SingleTargetAdapter invocation.
 *
 * One CoreExecutionResult corresponds to one attemptId and therefore exactly
 * one upstream attempt. Billing and cross-attempt aggregation happen outside
 * this contract.
 *
 * The discriminated union prevents impossible combinations such as a
 * successful result carrying an error or being marked retryable.
 */
export type CoreExecutionResult =
  | (CoreExecutionResultBase & {
      readonly status: "succeeded";
      readonly error: null;
      readonly retryability: "not-retryable";
      readonly interruption: "none";
    })
  | (CoreExecutionResultBase & {
      readonly status: Exclude<CoreExecutionStatus, "succeeded">;
      readonly error: NormalizedExecutionError;
      readonly retryability: Retryability;
      readonly interruption: InterruptionStatus;
    });
