import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";

/**
 * One planned upstream attempt.
 *
 * The plan is created before execution starts.
 * The runner executes attempts in order and does not discover new targets.
 */
export interface ExecutionAttemptPlan {
  /**
   * Stable ordering inside the execution plan.
   */
  readonly sequence: number;

  /**
   * Already resolved upstream target.
   */
  readonly target: ExecutionTarget;
}

/**
 * Immutable execution plan owned by TokenU orchestration.
 *
 * Routing, fallback and retry decisions happen when this plan is created.
 * The execution runner only follows the declared attempts.
 */
export interface TokenUExecutionPlan {
  readonly requestId: string;

  /**
   * Ordered attempts to execute.
   */
  readonly attempts: readonly ExecutionAttemptPlan[];
}
