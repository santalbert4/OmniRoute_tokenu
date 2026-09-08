import type { ExecutionUsageRecord } from "@/tokenu/contracts/executionUsageRecord";
import type { ExecutionUsageSink } from "@/tokenu/runtime/executionUsageSink";
import type { ExecutionUsageRepository } from "@/tokenu/runtime/executionUsageRepository";

export class ExecutionUsageRepositorySink implements ExecutionUsageSink {
  constructor(private readonly repository: ExecutionUsageRepository) {}

  async record(record: ExecutionUsageRecord): Promise<void> {
    await this.repository.save(record);
  }
}
