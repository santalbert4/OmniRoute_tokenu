import type { TokenUExecutionPlan } from "@/tokenu/contracts/executionPlan";
import type { ExecutionRunResult } from "@/tokenu/contracts/executionRunResult";
import type { RetryPolicy } from "@/tokenu/contracts/retryPolicy";
import type { TokenUExecutionDispatcher } from "@/tokenu/runtime/executionDispatcher";
import type {
  ExecutionPlanRequestFactory,
  TokenUExecutionPlanRunner,
} from "@/tokenu/runtime/executionPlanRunner";

export interface DefaultExecutionPlanRunnerOptions {
  readonly dispatcher: TokenUExecutionDispatcher;
  readonly retryPolicy: RetryPolicy;
}

export class DefaultExecutionPlanRunner implements TokenUExecutionPlanRunner {
  private readonly dispatcher: TokenUExecutionDispatcher;
  private readonly retryPolicy: RetryPolicy;

  constructor(options: DefaultExecutionPlanRunnerOptions) {
    this.dispatcher = options.dispatcher;
    this.retryPolicy = options.retryPolicy;
  }

  async execute(
    plan: TokenUExecutionPlan,
    requestFactory: ExecutionPlanRequestFactory
  ): Promise<ExecutionRunResult> {
    for (let index = 0; index < plan.attempts.length; index += 1) {
      const request = requestFactory.create(plan.attempts[index]!.sequence);

      const dispatchResult = await this.dispatcher.execute(request);

      if (!dispatchResult.ok) {
        return {
          status: "dispatch-failed",
          error: dispatchResult.error,
        };
      }

      const result = dispatchResult.result;

      if (result.status === "succeeded") {
        return {
          status: "completed",
          result,
        };
      }

      const remainingAttempts = plan.attempts.length - index - 1;

      const decision = this.retryPolicy.evaluate(result, remainingAttempts);

      if (!decision.retry) {
        return {
          status: "completed",
          result,
        };
      }
    }

    throw new Error("Execution plan exhausted without terminal result.");
  }
}
