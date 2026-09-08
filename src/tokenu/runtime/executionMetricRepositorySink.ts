import type { ExecutionMetric } from "@/tokenu/contracts/executionMetric";
import type { ExecutionMetricSink } from "@/tokenu/runtime/executionMetricSink";
import type { ExecutionMetricRepository } from "@/tokenu/runtime/executionMetricRepository";

export class ExecutionMetricRepositorySink implements ExecutionMetricSink {
  constructor(private readonly repository: ExecutionMetricRepository) {}

  async record(metric: ExecutionMetric): Promise<void> {
    await this.repository.save(metric);
  }
}
