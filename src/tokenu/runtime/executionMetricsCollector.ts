import type { ExecutionEvent } from "@/tokenu/contracts/executionEvent";
import type { ExecutionMetricSink } from "@/tokenu/runtime/executionMetricSink";

export class ExecutionMetricsCollector {
  private readonly startedAt = new Map<string, string>();

  constructor(private readonly sink: ExecutionMetricSink) {}

  async consume(event: ExecutionEvent): Promise<void> {
    if (event.type === "attempt-started") {
      this.startedAt.set(event.context.attemptId, event.context.startedAt);

      return;
    }

    if (event.type === "attempt-completed") {
      const startedAt = this.startedAt.get(event.context.attemptId);

      if (!startedAt) {
        return;
      }

      const completedAt = new Date().toISOString();

      await this.sink.record({
        requestId: event.context.requestId,
        attemptId: event.context.attemptId,
        sequence: event.context.sequence,
        providerId: event.context.target.providerId,
        adapterId: event.context.target.adapterId,
        modelId: event.context.target.upstreamModelId,
        startedAt,
        completedAt,
        durationMs: Date.parse(completedAt) - Date.parse(startedAt),
        status: event.result.status === "succeeded" ? "succeeded" : "failed",
      });

      this.startedAt.delete(event.context.attemptId);
    }
  }
}
