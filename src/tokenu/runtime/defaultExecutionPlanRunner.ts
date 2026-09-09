import type { CoreExecutionRequest } from "@/tokenu/contracts/coreExecutionRequest";
import type { CoreExecutionResult } from "@/tokenu/contracts/coreExecutionResult";
import type { ExecutionAttemptContext } from "@/tokenu/contracts/executionAttemptContext";
import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";
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

function sameExecutionTarget(left: ExecutionTarget, right: ExecutionTarget): boolean {
  return (
    left.providerId === right.providerId &&
    left.modelOfferingId === right.modelOfferingId &&
    left.upstreamModelId === right.upstreamModelId &&
    left.connectionId === right.connectionId &&
    left.credentialMode === right.credentialMode &&
    left.technicalProfileId === right.technicalProfileId &&
    left.adapterId === right.adapterId &&
    left.endpointProfileId === right.endpointProfileId &&
    left.serviceRegion === right.serviceRegion
  );
}

function assertExecutionPlan(plan: TokenUExecutionPlan): void {
  if (plan.requestId.trim().length === 0) {
    throw new Error("TokenU execution plan requires request identity");
  }

  if (plan.attempts.length === 0) {
    throw new Error("TokenU execution plan requires at least one attempt");
  }

  const sequences = new Set<number>();

  for (const attempt of plan.attempts) {
    if (!Number.isSafeInteger(attempt.sequence) || attempt.sequence <= 0) {
      throw new Error("TokenU execution plan attempt sequence must be a positive safe integer");
    }

    if (sequences.has(attempt.sequence)) {
      throw new Error("TokenU execution plan attempt sequences must be unique");
    }

    sequences.add(attempt.sequence);
  }
}

function assertRequestIdentity(
  request: CoreExecutionRequest,
  context: ExecutionAttemptContext
): void {
  if (request.requestId !== context.requestId) {
    throw new Error("TokenU execution request requestId does not match attempt context");
  }

  if (request.attemptId !== context.attemptId) {
    throw new Error("TokenU execution request attemptId does not match attempt context");
  }

  if (!sameExecutionTarget(request.target, context.target)) {
    throw new Error("TokenU execution request target does not match attempt context");
  }
}

function assertResultIdentity(result: CoreExecutionResult, context: ExecutionAttemptContext): void {
  if (result.requestId !== context.requestId) {
    throw new Error("TokenU execution result requestId does not match attempt context");
  }

  if (result.attemptId !== context.attemptId) {
    throw new Error("TokenU execution result attemptId does not match attempt context");
  }

  if (!sameExecutionTarget(result.target, context.target)) {
    throw new Error("TokenU execution result target does not match attempt context");
  }
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
    assertExecutionPlan(plan);

    for (let index = 0; index < plan.attempts.length; index += 1) {
      const attempt = plan.attempts[index]!;

      const context: ExecutionAttemptContext = {
        requestId: plan.requestId,
        attemptId: `${plan.requestId}-${attempt.sequence}`,
        sequence: attempt.sequence,
        target: attempt.target,
        startedAt: new Date().toISOString(),
        retryNumber: index,
      };

      const request = requestFactory.create(context);

      assertRequestIdentity(request, context);

      await this.eventSink.emit({
        type: "attempt-started",
        context,
      });

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

      assertResultIdentity(result, context);

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
