import type { NormalizedUsage } from "@/tokenu/contracts/usage";

export interface ExecutionUsageRecord {
  readonly requestId: string;
  readonly attemptId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly usage: NormalizedUsage;
  readonly recordedAt: string;
}
