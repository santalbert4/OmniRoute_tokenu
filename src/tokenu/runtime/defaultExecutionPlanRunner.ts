import type { TokenUExecutionPlan } from "@/tokenu/contracts/executionPlan";
import type { ExecutionRunResult } from "@/tokenu/contracts/executionRunResult";
import type { RetryPolicy } from "@/tokenu/contracts/retryPolicy";
import type { TokenUExecutionDispatcher } from "@/tokenu/runtime/executionDispatcher";
import type { ExecutionEventSink } from "@/tokenu/runtime/executionEventSink";
import type {
  ExecutionPlanRequestFactory,
  TokenUExecutionPlanRunner,
} from "@/tokenu/runtime/executionPlanRunner";

export interface DefaultExecutionPlanRunnerOptions {
  readonly dispatcher: TokenUExecutionDispatcher;
  readonly retryPolicy: RetryPolicy;
  readonly eventSink: ExecutionEventSink;
}

export class DefaultExecutionPlanRunner implements TokenUExecutionPlanRunner {
  private readonly dispatcher: TokenUExecutionDispatcher;
  private readonly retryPolicy: RetryPolicy;
  private readonly eventSink: ExecutionEventSink;

  constructor(options: DefaultExecutionPlanRunnerOptions) {
    this.dispatcher = options.dispatcher;
    this.retryPolicy = options.retryPolicy;
    this.eventSink = options.eventSink;
  }

  async execute(
    plan: TokenUExecutionPlan,
    requestFactory: ExecutionPlanRequestFactory
  ): Promise<ExecutionRunResult> {
    for (let index = 0; index < plan.attempts.length; index += 1) {
      const attempt = plan.attempts[index]!;

      const context = {
        requestId: plan.requestId,
        attemptId: `${plan.requestId}-${attempt.sequence}`,
        sequence: attempt.sequence,
        target: attempt.target,
        startedAt: new Date().toISOString(),
        retryNumber: index,
      };

      await this.eventSink.emit({
        type: "attempt-started",
        context,
      });

      const request = requestFactory.create(attempt.sequence);

      const dispatchResult = await this.dispatcher.execute(request);

      if (!dispatchResult.ok) {
        await this.eventSink.emit({
          type: "attempt-dispatch-failed",
          context,
          error: dispatchResult.error,
        });

        return {
          status: "dispatch-failed",
          error: dispatchResult.error,
        };
      }

      const result = dispatchResult.result;

      await this.eventSink.emit({
        type: "attempt-completed",
        context,
        result,
      });

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
