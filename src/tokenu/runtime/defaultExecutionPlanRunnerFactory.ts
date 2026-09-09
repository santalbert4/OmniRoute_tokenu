import type { RetryPolicy } from "@/tokenu/contracts/retryPolicy";
import { DefaultExecutionPlanRunner } from "@/tokenu/runtime/defaultExecutionPlanRunner";
import type { TokenUExecutionDispatcher } from "@/tokenu/runtime/executionDispatcher";
import type {
  ExecutionPlanRunnerFactory,
  ExecutionPlanRunnerFactoryOptions,
} from "@/tokenu/runtime/executionPlanRunnerFactory";
import type { TokenUExecutionPlanRunner } from "@/tokenu/runtime/executionPlanRunner";

export interface DefaultExecutionPlanRunnerFactoryOptions {
  readonly dispatcher: TokenUExecutionDispatcher;
  readonly retryPolicy: RetryPolicy;
}

/**
 * Production runner factory bound to reviewed technical execution dependencies.
 *
 * Tenant identity and billing are supplied separately through the event sink.
 */
export class DefaultExecutionPlanRunnerFactory implements ExecutionPlanRunnerFactory {
  constructor(private readonly options: DefaultExecutionPlanRunnerFactoryOptions) {}

  create(options: ExecutionPlanRunnerFactoryOptions): TokenUExecutionPlanRunner {
    return new DefaultExecutionPlanRunner({
      dispatcher: this.options.dispatcher,
      retryPolicy: this.options.retryPolicy,
      eventSink: options.eventSink,
    });
  }
}
