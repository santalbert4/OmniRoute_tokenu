import type { ExecutionMetric } from "@/tokenu/contracts/executionMetric";
import type { ExecutionMetricSink } from "@/tokenu/runtime/executionMetricSink";

export class InMemoryExecutionMetricSink implements ExecutionMetricSink {
  private readonly metrics: ExecutionMetric[] = [];

  async record(metric: ExecutionMetric): Promise<void> {
    this.metrics.push(metric);
  }

  getMetrics(): readonly ExecutionMetric[] {
    return this.metrics;
  }
}
