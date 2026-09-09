import type { ExecutionEventConsumer } from "@/tokenu/runtime/executionEventConsumer";
import type { ExecutionEventSink } from "@/tokenu/runtime/executionEventSink";
import type { CostLedgerService } from "@/tokenu/runtime/costLedgerService";
import {
  CompositeExecutionEventSink,
  type BestEffortExecutionEventFailure,
} from "@/tokenu/runtime/compositeExecutionEventSink";
import { ExecutionBillingCollector } from "@/tokenu/runtime/executionBillingCollector";

export interface TenantExecutionEventSinkFactoryOptions {
  /**
   * Optional non-authoritative projections such as metrics or analytics.
   *
   * Failures from these consumers must never make execution delivery fail.
   */
  readonly bestEffortConsumers?: readonly ExecutionEventConsumer[];

  readonly onBestEffortError?: (failure: BestEffortExecutionEventFailure) => void;
}

/**
 * Builds one tenant-aware execution event pipeline.
 *
 * Workspace identity enters only at this trusted orchestration boundary.
 * Authoritative billing is always critical.
 * Telemetry consumers are optional and best-effort.
 */
export class TenantExecutionEventSinkFactory {
  constructor(private readonly costLedgerService: CostLedgerService) {}

  create(
    workspaceId: string,
    options: TenantExecutionEventSinkFactoryOptions = {}
  ): ExecutionEventSink {
    const billingCollector = new ExecutionBillingCollector(workspaceId, this.costLedgerService);

    return new CompositeExecutionEventSink({
      criticalConsumers: [billingCollector],
      bestEffortConsumers: options.bestEffortConsumers ?? [],
      onBestEffortError: options.onBestEffortError,
    });
  }
}
