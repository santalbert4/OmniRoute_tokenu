import type { ExecutionEventConsumer } from "@/tokenu/runtime/executionEventConsumer";
import type { ExecutionEventSink } from "@/tokenu/runtime/executionEventSink";
import type { CostLedgerService } from "@/tokenu/runtime/costLedgerService";
import {
  CompositeExecutionEventSink,
  type BestEffortExecutionEventFailure,
} from "@/tokenu/runtime/compositeExecutionEventSink";
import { ExecutionBillingCollector } from "@/tokenu/runtime/executionBillingCollector";
import { TenantUsageProjectionCollector } from "@/tokenu/runtime/tenantUsageProjectionCollector";
import type { UsageProjectionService } from "@/tokenu/runtime/usageProjectionService";

type UsageProjectionServicePort = Pick<UsageProjectionService, "recordExecution">;

export interface TenantExecutionEventSinkFactoryOptions {
  /**
   * Additional non-authoritative consumers such as metrics or telemetry.
   *
   * The persistent TokenU usage projection is installed automatically and does
   * not need to be supplied here.
   */
  readonly bestEffortConsumers?: readonly ExecutionEventConsumer[];

  readonly onBestEffortError?: (failure: BestEffortExecutionEventFailure) => void;
}

/**
 * Builds one tenant-aware execution event pipeline.
 *
 * Workspace identity enters only at this trusted orchestration boundary.
 * Authoritative billing is always critical.
 * Persistent usage projection is always installed as best-effort.
 * Additional telemetry consumers remain optional and best-effort.
 */
export class TenantExecutionEventSinkFactory {
  constructor(
    private readonly costLedgerService: CostLedgerService,
    private readonly usageProjectionService: UsageProjectionServicePort
  ) {}

  create(
    workspaceId: string,
    options: TenantExecutionEventSinkFactoryOptions = {}
  ): ExecutionEventSink {
    const billingCollector = new ExecutionBillingCollector(workspaceId, this.costLedgerService);

    const usageProjectionCollector = new TenantUsageProjectionCollector(
      workspaceId,
      this.usageProjectionService
    );

    return new CompositeExecutionEventSink({
      criticalConsumers: [billingCollector],
      bestEffortConsumers: [usageProjectionCollector, ...(options.bestEffortConsumers ?? [])],
      onBestEffortError: options.onBestEffortError,
    });
  }
}
