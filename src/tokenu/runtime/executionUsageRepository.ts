import type { ExecutionUsageRecord } from "@/tokenu/contracts/executionUsageRecord";

export interface ExecutionUsageRepository {
  save(record: ExecutionUsageRecord): Promise<void>;

  list(): Promise<readonly ExecutionUsageRecord[]>;

  findByRequestId(requestId: string): Promise<readonly ExecutionUsageRecord[]>;

  findByProvider(providerId: string): Promise<readonly ExecutionUsageRecord[]>;
}
