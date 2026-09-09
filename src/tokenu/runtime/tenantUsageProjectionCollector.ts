import type { ExecutionEvent } from "@/tokenu/contracts/executionEvent";
import type { ExecutionEventConsumer } from "@/tokenu/runtime/executionEventConsumer";
import type { UsageProjectionService } from "@/tokenu/runtime/usageProjectionService";

type UsageProjectionServicePort = Pick<UsageProjectionService, "recordExecution">;

/**
 * Tenant-aware analytical projection consumer.
 *
 * Workspace identity enters at the trusted orchestration boundary and remains
 * outside low-level execution contracts.
 */
export class TenantUsageProjectionCollector implements ExecutionEventConsumer {
  constructor(
    private readonly workspaceId: string,
    private readonly usageProjectionService: UsageProjectionServicePort
  ) {
    if (workspaceId.trim().length === 0) {
      throw new Error("TokenU usage projection collector requires workspace identity");
    }
  }

  async consume(event: ExecutionEvent): Promise<void> {
    if (event.type !== "attempt-completed") {
      return;
    }

    await this.usageProjectionService.recordExecution({
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
