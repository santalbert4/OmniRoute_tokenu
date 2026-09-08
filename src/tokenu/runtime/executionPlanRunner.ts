import type { CoreExecutionRequest } from "@/tokenu/contracts/coreExecutionRequest";
import type { TokenUExecutionPlan } from "@/tokenu/contracts/executionPlan";
import type { ExecutionRunResult } from "@/tokenu/contracts/executionRunResult";

export interface ExecutionPlanRequestFactory {
  create(attemptSequence: number): CoreExecutionRequest;
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
