import type { CoreExecutionRequest } from "@/tokenu/contracts/coreExecutionRequest";
import type { ExecutionAttemptContext } from "@/tokenu/contracts/executionAttemptContext";
import type { TokenUExecutionPlan } from "@/tokenu/contracts/executionPlan";
import type { ExecutionRunResult } from "@/tokenu/contracts/executionRunResult";

export interface ExecutionPlanRequestFactory {
  /**
   * Builds the exact request for one authoritative runner-owned attempt.
   *
   * The factory must preserve requestId, attemptId and target from context.
   * It must not create or infer a second attempt identity.
   */
  create(context: ExecutionAttemptContext): CoreExecutionRequest;
}

/**
 * Executes an immutable TokenU execution plan.
 *
 * The runner follows the declared attempts.
 * Routing decisions are outside this boundary.
 */
export interface TokenUExecutionPlanRunner {
  execute(
    plan: TokenUExecutionPlan,
    requestFactory: ExecutionPlanRequestFactory
  ): Promise<ExecutionRunResult>;
}
