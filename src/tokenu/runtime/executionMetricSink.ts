import type { ExecutionMetric } from "@/tokenu/contracts/executionMetric";

/**
 * Boundary for TokenU execution metrics.
 *
 * Runtime components emit metrics without knowing
 * where metrics are stored or processed.
 */
export interface ExecutionMetricSink {
  record(metric: ExecutionMetric): Promise<void>;
}
