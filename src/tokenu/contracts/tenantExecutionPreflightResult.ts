import type { WorkspacePlan } from "@/tokenu/contracts/workspacePlan";
import type { WorkspaceQuotaDecision } from "@/tokenu/contracts/workspaceQuotaDecision";

export type TenantExecutionPreflightResult =
  | {
      readonly status: "allowed";
      readonly plan: WorkspacePlan;
      readonly quota: WorkspaceQuotaDecision;
    }
  | {
      readonly status: "plan-unavailable";
      readonly reason: "workspace plan not assigned";
    }
  | {
      readonly status: "quota-denied";
      readonly plan: WorkspacePlan;
      readonly quota: WorkspaceQuotaDecision;
    };
