import type { RequestAdmissionResult } from "@/tokenu/contracts/requestAdmissionResult";
import type { WorkspaceRequestUsage } from "@/tokenu/contracts/workspaceRequestUsage";

export interface WorkspaceRequestUsageRepository {
  get(workspaceId: string, period: string): Promise<WorkspaceRequestUsage | null>;

  increment(workspaceId: string, period: string): Promise<void>;

  /**
   * Atomically consumes one request only when the monthly limit
   * has not yet been reached.
   */
  tryConsume(
    workspaceId: string,
    period: string,
    monthlyRequestLimit: number
  ): Promise<RequestAdmissionResult>;
}
