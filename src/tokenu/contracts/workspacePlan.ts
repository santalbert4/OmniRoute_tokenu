export type WorkspacePlanTier = "free" | "starter" | "pro" | "enterprise";

export interface WorkspacePlan {
  readonly id: string;

  readonly tier: WorkspacePlanTier;

  readonly monthlyCostLimit: number;

  readonly monthlyRequestLimit: number;

  readonly currency: string;
}
