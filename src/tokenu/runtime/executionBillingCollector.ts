import type { ExecutionEvent } from "@/tokenu/contracts/executionEvent";
import type { CostLedgerService } from "@/tokenu/runtime/costLedgerService";
import type { ExecutionEventConsumer } from "@/tokenu/runtime/executionEventConsumer";

/**
 * Tenant-aware commercial projection of completed execution attempts.
 *
 * Workspace identity is supplied by trusted orchestration and is not
 * added to the low-level execution contracts.
 */
export class ExecutionBillingCollector implements ExecutionEventConsumer {
  constructor(
    private readonly workspaceId: string,
    private readonly costLedgerService: CostLedgerService
  ) {
    if (workspaceId.trim().length === 0) {
      throw new Error("TokenU billing collector requires workspace identity");
    }
  }

  async consume(event: ExecutionEvent): Promise<void> {
    if (event.type !== "attempt-completed") {
      return;
    }

    await this.costLedgerService.recordExecution({
      workspaceId: this.workspaceId,
      requestId: event.context.requestId,
      attemptId: event.context.attemptId,
      providerId: event.context.target.providerId,
      modelId: event.context.target.upstreamModelId,
      usage: event.result.usage,
      recordedAt: event.result.timing.completedAt,
    });
  }
}
