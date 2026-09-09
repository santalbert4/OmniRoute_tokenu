import type { RequestAdmissionResult } from "@/tokenu/contracts/requestAdmissionResult";
import type { WorkspaceRequestUsageRepository } from "@/tokenu/runtime/workspaceRequestUsageRepository";

/**
 * Authoritative request admission boundary.
 *
 * Unlike read-only quota preflight, this service consumes one request
 * slot atomically through the repository.
 */
export class RequestAdmissionService {
  constructor(private readonly repository: WorkspaceRequestUsageRepository) {}

  async admit(
    workspaceId: string,
    period: string,
    monthlyRequestLimit: number
  ): Promise<RequestAdmissionResult> {
    if (workspaceId.trim().length === 0) {
      throw new Error("TokenU request admission requires workspace identity");
    }

    if (period.trim().length === 0) {
      throw new Error("TokenU request admission requires usage period");
    }

    if (!Number.isSafeInteger(monthlyRequestLimit) || monthlyRequestLimit < 0) {
      throw new Error("TokenU monthly request limit must be a non-negative safe integer");
    }

    return this.repository.tryConsume(workspaceId, period, monthlyRequestLimit);
  }
}
