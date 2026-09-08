import type { ExecutionMetric } from "@/tokenu/contracts/executionMetric";

export interface ExecutionMetricRepository {
  save(metric: ExecutionMetric): Promise<void>;

  list(): Promise<readonly ExecutionMetric[]>;

  findByRequestId(requestId: string): Promise<readonly ExecutionMetric[]>;

  findByProvider(providerId: string): Promise<readonly ExecutionMetric[]>;
}
