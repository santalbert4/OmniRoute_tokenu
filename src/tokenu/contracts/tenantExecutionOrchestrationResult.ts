import type { RequestAdmissionResult } from "@/tokenu/contracts/requestAdmissionResult";
import type { ExecutionRunResult } from "@/tokenu/contracts/executionRunResult";
import type { WorkspacePlan } from "@/tokenu/contracts/workspacePlan";
import type { WorkspaceQuotaDecision } from "@/tokenu/contracts/workspaceQuotaDecision";

type AdmittedRequest = Extract<RequestAdmissionResult, { admitted: true }>;

type DeniedRequest = Extract<RequestAdmissionResult, { admitted: false }>;

/**
 * SaaS-level result of one trusted tenant execution orchestration.
 *
 * Preflight and admission failures are distinct from technical execution
 * results. Once admitted, the nested ExecutionRunResult describes the
 * terminal technical execution outcome.
 */
export type TenantExecutionOrchestrationResult =
  | {
      readonly status: "plan-unavailable";
      readonly reason: "workspace plan not assigned";
    }
  | {
      readonly status: "quota-denied";
      readonly plan: WorkspacePlan;
      readonly quota: WorkspaceQuotaDecision;
    }
  | {
      readonly status: "admission-denied";
      readonly plan: WorkspacePlan;
      readonly admission: DeniedRequest;
    }
  | {
      readonly status: "executed";
      readonly plan: WorkspacePlan;
      readonly admission: AdmittedRequest;
      readonly execution: ExecutionRunResult;
    };
