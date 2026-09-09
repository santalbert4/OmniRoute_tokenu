import type { RequestAdmissionResult } from "@/tokenu/contracts/requestAdmissionResult";
import type { WorkspaceRequestUsage } from "@/tokenu/contracts/workspaceRequestUsage";
import type { WorkspaceRequestUsageRepository } from "@/tokenu/runtime/workspaceRequestUsageRepository";

function validateLimit(monthlyRequestLimit: number): void {
  if (!Number.isSafeInteger(monthlyRequestLimit) || monthlyRequestLimit < 0) {
    throw new Error("TokenU monthly request limit must be a non-negative safe integer");
  }
}

export class InMemoryWorkspaceRequestUsageRepository implements WorkspaceRequestUsageRepository {
  private readonly usage = new Map<string, WorkspaceRequestUsage>();

  async get(workspaceId: string, period: string): Promise<WorkspaceRequestUsage | null> {
    const key = `${workspaceId}:${period}`;

    return this.usage.get(key) ?? null;
  }

  async increment(workspaceId: string, period: string): Promise<void> {
    const key = `${workspaceId}:${period}`;

    const current = this.usage.get(key);

    this.usage.set(key, {
      workspaceId,
      period,
      requestCount: (current?.requestCount ?? 0) + 1,
    });
  }

  async tryConsume(
    workspaceId: string,
    period: string,
    monthlyRequestLimit: number
  ): Promise<RequestAdmissionResult> {
    validateLimit(monthlyRequestLimit);

    const key = `${workspaceId}:${period}`;
    const current = this.usage.get(key)?.requestCount ?? 0;

    if (current >= monthlyRequestLimit) {
      return {
        admitted: false,
        remainingRequests: 0,
        reason: "monthly request quota exceeded",
      };
    }

    const requestCount = current + 1;

    this.usage.set(key, {
      workspaceId,
      period,
      requestCount,
    });

    return {
      admitted: true,
      requestCount,
      remainingRequests: monthlyRequestLimit - requestCount,
    };
  }
}
