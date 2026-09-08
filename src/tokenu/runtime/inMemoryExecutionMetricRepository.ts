import type { ExecutionMetric } from "@/tokenu/contracts/executionMetric";
import type { ExecutionMetricRepository } from "@/tokenu/runtime/executionMetricRepository";

export class InMemoryExecutionMetricRepository implements ExecutionMetricRepository {
  private readonly metrics: ExecutionMetric[] = [];

  async save(metric: ExecutionMetric): Promise<void> {
    this.metrics.push(metric);
  }

  async list(): Promise<readonly ExecutionMetric[]> {
    return this.metrics;
  }

  async findByRequestId(requestId: string): Promise<readonly ExecutionMetric[]> {
    return this.metrics.filter((metric) => metric.requestId === requestId);
  }

  async findByProvider(providerId: string): Promise<readonly ExecutionMetric[]> {
    return this.metrics.filter((metric) => metric.providerId === providerId);
  }
}
