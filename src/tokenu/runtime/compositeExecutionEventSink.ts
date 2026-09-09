import type { ExecutionEvent } from "@/tokenu/contracts/executionEvent";
import type { ExecutionEventConsumer } from "@/tokenu/runtime/executionEventConsumer";
import type { ExecutionEventSink } from "@/tokenu/runtime/executionEventSink";

export interface BestEffortExecutionEventFailure {
  readonly event: ExecutionEvent;
  readonly consumerIndex: number;
  readonly error: unknown;
}

export interface CompositeExecutionEventSinkOptions {
  readonly criticalConsumers?: readonly ExecutionEventConsumer[];
  readonly bestEffortConsumers?: readonly ExecutionEventConsumer[];

  /**
   * Observability hook for best-effort delivery failures.
   *
   * This callback is itself non-critical: if it throws, the execution
   * path still must not fail because of telemetry/error reporting.
   */
  readonly onBestEffortError?: (failure: BestEffortExecutionEventFailure) => void;
}

/**
 * Fans one execution event out according to explicit delivery policy.
 *
 * Critical consumers:
 *   - are awaited
 *   - propagate failures to the caller
 *
 * Best-effort consumers:
 *   - are invoked for the event
 *   - never make emit() reject
 *   - report failures through onBestEffortError when configured
 *
 * Billing belongs in the critical group.
 * Metrics and analytical telemetry belong in the best-effort group.
 */
export class CompositeExecutionEventSink implements ExecutionEventSink {
  private readonly criticalConsumers: readonly ExecutionEventConsumer[];
  private readonly bestEffortConsumers: readonly ExecutionEventConsumer[];
  private readonly onBestEffortError:
    ((failure: BestEffortExecutionEventFailure) => void) | undefined;

  constructor(options: CompositeExecutionEventSinkOptions) {
    this.criticalConsumers = options.criticalConsumers ?? [];

    this.bestEffortConsumers = options.bestEffortConsumers ?? [];

    this.onBestEffortError = options.onBestEffortError;
  }

  async emit(event: ExecutionEvent): Promise<void> {
    const criticalDelivery = Promise.all(
      this.criticalConsumers.map((consumer) => consumer.consume(event))
    );

    const bestEffortDelivery = Promise.allSettled(
      this.bestEffortConsumers.map((consumer) => consumer.consume(event))
    ).then((results) => {
      results.forEach((result, consumerIndex) => {
        if (result.status !== "rejected") {
          return;
        }

        try {
          this.onBestEffortError?.({
            event,
            consumerIndex,
            error: result.reason,
          });
        } catch {
          // Error reporting is intentionally non-critical.
        }
      });
    });

    await Promise.all([criticalDelivery, bestEffortDelivery]);
  }
}
