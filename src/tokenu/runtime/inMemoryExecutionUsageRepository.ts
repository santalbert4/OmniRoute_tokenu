import type { ExecutionUsageRecord } from "@/tokenu/contracts/executionUsageRecord";
import type { ExecutionUsageRepository } from "@/tokenu/runtime/executionUsageRepository";

export class InMemoryExecutionUsageRepository implements ExecutionUsageRepository {
  private readonly records: ExecutionUsageRecord[] = [];

  async save(record: ExecutionUsageRecord): Promise<void> {
    this.records.push(record);
  }

  async list(): Promise<readonly ExecutionUsageRecord[]> {
    return this.records;
  }

  async findByRequestId(requestId: string): Promise<readonly ExecutionUsageRecord[]> {
    return this.records.filter((record) => record.requestId === requestId);
  }

  async findByProvider(providerId: string): Promise<readonly ExecutionUsageRecord[]> {
    return this.records.filter((record) => record.providerId === providerId);
  }
}
