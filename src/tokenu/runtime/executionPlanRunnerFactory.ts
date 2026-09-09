import type { ExecutionEventSink } from "@/tokenu/runtime/executionEventSink";
import type { TokenUExecutionPlanRunner } from "@/tokenu/runtime/executionPlanRunner";

export interface ExecutionPlanRunnerFactoryOptions {
  /**
   * Tenant-aware event sink created by the trusted orchestration boundary.
   */
  readonly eventSink: ExecutionEventSink;
}

/**
 * Produces a plan runner bound to the technical execution dependencies.
 *
 * Dispatcher, adapter registry, secret resolution and retry policy remain
 * outside the tenant orchestrator.
 */
export interface ExecutionPlanRunnerFactory {
  create(options: ExecutionPlanRunnerFactoryOptions): TokenUExecutionPlanRunner;
}
