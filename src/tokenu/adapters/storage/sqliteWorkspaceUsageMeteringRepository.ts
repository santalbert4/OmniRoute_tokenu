import type { WorkspaceUsageMetering } from "@/tokenu/contracts/workspaceUsageMetering";
import { fromMoneyMicros, toMoneyMicros } from "@/tokenu/adapters/storage/moneyMicros";
import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type {
  WorkspaceUsageMeteringIncrement,
  WorkspaceUsageMeteringRepository,
} from "@/tokenu/runtime/workspaceUsageMeteringRepository";

interface WorkspaceUsageMeteringRow {
  readonly workspace_id: string;
  readonly period: string;
  readonly metered_execution_count: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly estimated_cost_micros: number;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isWorkspaceUsageMeteringRow(value: unknown): value is WorkspaceUsageMeteringRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.workspace_id === "string" &&
    row.workspace_id.trim().length > 0 &&
    typeof row.period === "string" &&
    row.period.trim().length > 0 &&
    isNonNegativeSafeInteger(row.metered_execution_count) &&
    isNonNegativeSafeInteger(row.input_tokens) &&
    isNonNegativeSafeInteger(row.output_tokens) &&
    isNonNegativeSafeInteger(row.estimated_cost_micros)
  );
}

function assertUsageCounter(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`TokenU ${name} must be a non-negative safe integer`);
  }
}

export class SqliteWorkspaceUsageMeteringRepository implements WorkspaceUsageMeteringRepository {
  constructor(private readonly db: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async get(workspaceId: string, period: string): Promise<WorkspaceUsageMetering | null> {
    const row = this.db
      .prepare(
        `SELECT
           workspace_id,
           period,
           metered_execution_count,
           input_tokens,
           output_tokens,
           estimated_cost_micros
         FROM tokenu_workspace_usage_metering
         WHERE workspace_id = ?
           AND period = ?`
      )
      .get(workspaceId, period);

    if (!row) {
      return null;
    }

    if (!isWorkspaceUsageMeteringRow(row)) {
      throw new Error("Invalid TokenU workspace usage metering row");
    }

    return {
      workspaceId: row.workspace_id,
      period: row.period,
      meteredExecutionCount: row.metered_execution_count,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      estimatedCost: fromMoneyMicros(row.estimated_cost_micros),
    };
  }

  async save(usage: WorkspaceUsageMetering): Promise<void> {
    assertUsageCounter(usage.meteredExecutionCount, "metered execution count");

    assertUsageCounter(usage.inputTokens, "input token count");

    assertUsageCounter(usage.outputTokens, "output token count");

    this.db
      .prepare(
        `INSERT INTO tokenu_workspace_usage_metering (
           workspace_id,
           period,
           metered_execution_count,
           input_tokens,
           output_tokens,
           estimated_cost_micros
         )
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id, period)
         DO UPDATE SET
           metered_execution_count =
             excluded.metered_execution_count,
           input_tokens =
             excluded.input_tokens,
           output_tokens =
             excluded.output_tokens,
           estimated_cost_micros =
             excluded.estimated_cost_micros`
      )
      .run(
        usage.workspaceId,
        usage.period,
        usage.meteredExecutionCount,
        usage.inputTokens,
        usage.outputTokens,
        toMoneyMicros(usage.estimatedCost)
      );
  }

  async increment(
    workspaceId: string,
    period: string,
    delta: WorkspaceUsageMeteringIncrement
  ): Promise<void> {
    assertUsageCounter(delta.inputTokens, "input token delta");

    assertUsageCounter(delta.outputTokens, "output token delta");

    this.db
      .prepare(
        `INSERT INTO tokenu_workspace_usage_metering (
           workspace_id,
           period,
           metered_execution_count,
           input_tokens,
           output_tokens,
           estimated_cost_micros
         )
         VALUES (?, ?, 1, ?, ?, ?)
         ON CONFLICT(workspace_id, period)
         DO UPDATE SET
           metered_execution_count =
             tokenu_workspace_usage_metering.metered_execution_count + 1,
           input_tokens =
             tokenu_workspace_usage_metering.input_tokens +
             excluded.input_tokens,
           output_tokens =
             tokenu_workspace_usage_metering.output_tokens +
             excluded.output_tokens,
           estimated_cost_micros =
             tokenu_workspace_usage_metering.estimated_cost_micros +
             excluded.estimated_cost_micros`
      )
      .run(
        workspaceId,
        period,
        delta.inputTokens,
        delta.outputTokens,
        toMoneyMicros(delta.estimatedCost)
      );
  }
}
