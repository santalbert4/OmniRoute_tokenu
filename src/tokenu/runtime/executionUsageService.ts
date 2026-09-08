import type { ExecutionUsageRecord } from "@/tokenu/contracts/executionUsageRecord";
import type { ExecutionUsageRepository } from "@/tokenu/runtime/executionUsageRepository";

export class ExecutionUsageService {
  constructor(private readonly repository: ExecutionUsageRepository) {}

  async list(): Promise<readonly ExecutionUsageRecord[]> {
    return this.repository.list();
  }

  async findByRequestId(requestId: string): Promise<readonly ExecutionUsageRecord[]> {
    return this.repository.findByRequestId(requestId);
  }

  async findByProvider(providerId: string): Promise<readonly ExecutionUsageRecord[]> {
    return this.repository.findByProvider(providerId);
  }
}
