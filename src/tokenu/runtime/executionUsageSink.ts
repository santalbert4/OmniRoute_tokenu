import type { ExecutionUsageRecord } from "@/tokenu/contracts/executionUsageRecord";

export interface ExecutionUsageSink {
  record(record: ExecutionUsageRecord): Promise<void>;
}
