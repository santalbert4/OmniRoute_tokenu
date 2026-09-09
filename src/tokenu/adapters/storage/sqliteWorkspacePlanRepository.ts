import type { WorkspacePlan, WorkspacePlanTier } from "@/tokenu/contracts/workspacePlan";
import type { WorkspacePlanRepository } from "@/tokenu/runtime/workspacePlanRepository";
import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import { fromMoneyMicros, toMoneyMicros } from "@/tokenu/adapters/storage/moneyMicros";

interface WorkspacePlanRow {
  readonly id: string;
  readonly tier: WorkspacePlanTier;
  readonly monthly_cost_limit_micros: number;
  readonly monthly_request_limit: number;
  readonly currency: string;
}

function isWorkspacePlanTier(value: unknown): value is WorkspacePlanTier {
  return value === "free" || value === "starter" || value === "pro" || value === "enterprise";
}

function isWorkspacePlanRow(value: unknown): value is WorkspacePlanRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.id === "string" &&
    row.id.trim().length > 0 &&
    isWorkspacePlanTier(row.tier) &&
    typeof row.monthly_cost_limit_micros === "number" &&
    Number.isSafeInteger(row.monthly_cost_limit_micros) &&
    row.monthly_cost_limit_micros >= 0 &&
    typeof row.monthly_request_limit === "number" &&
    Number.isSafeInteger(row.monthly_request_limit) &&
    row.monthly_request_limit >= 0 &&
    typeof row.currency === "string" &&
    row.currency.trim().length > 0
  );
}

export class SqliteWorkspacePlanRepository implements WorkspacePlanRepository {
  constructor(private readonly db: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async get(planId: string): Promise<WorkspacePlan | null> {
    const row = this.db
      .prepare(
        `SELECT
           id,
           tier,
           monthly_cost_limit_micros,
           monthly_request_limit,
           currency
         FROM tokenu_workspace_plans
         WHERE id = ?`
      )
      .get(planId);

    if (!row) {
      return null;
    }

    if (!isWorkspacePlanRow(row)) {
      throw new Error("Invalid TokenU workspace plan row");
    }

    return {
      id: row.id,
      tier: row.tier,
      monthlyCostLimit: fromMoneyMicros(row.monthly_cost_limit_micros),
      monthlyRequestLimit: row.monthly_request_limit,
      currency: row.currency,
    };
  }

  async save(plan: WorkspacePlan): Promise<void> {
    if (!Number.isSafeInteger(plan.monthlyRequestLimit) || plan.monthlyRequestLimit < 0) {
      throw new Error("TokenU monthly request limit must be a non-negative safe integer");
    }

    this.db
      .prepare(
        `INSERT INTO tokenu_workspace_plans (
           id,
           tier,
           monthly_cost_limit_micros,
           monthly_request_limit,
           currency
         )
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id)
         DO UPDATE SET
           tier = excluded.tier,
           monthly_cost_limit_micros =
             excluded.monthly_cost_limit_micros,
           monthly_request_limit =
             excluded.monthly_request_limit,
           currency = excluded.currency`
      )
      .run(
        plan.id,
        plan.tier,
        toMoneyMicros(plan.monthlyCostLimit),
        plan.monthlyRequestLimit,
        plan.currency
      );
  }
}
