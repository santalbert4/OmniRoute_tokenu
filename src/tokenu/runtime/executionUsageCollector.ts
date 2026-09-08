import type { ExecutionEvent } from "@/tokenu/contracts/executionEvent";
import type { ExecutionUsageSink } from "@/tokenu/runtime/executionUsageSink";

export class ExecutionUsageCollector {
  constructor(private readonly sink: ExecutionUsageSink) {}

  async consume(event: ExecutionEvent): Promise<void> {
    if (event.type !== "attempt-completed") {
      return;
    }

    await this.sink.record({
      requestId: event.context.requestId,
      attemptId: event.context.attemptId,
      providerId: event.context.target.providerId,
      modelId: event.context.target.upstreamModelId,
      usage: event.result.usage,
      recordedAt: event.result.timing.completedAt,
    });
  }
}
