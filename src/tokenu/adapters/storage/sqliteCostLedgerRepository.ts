import type { CostLedgerEntry } from "@/tokenu/contracts/costLedgerEntry";
import type { CostLedgerPeriodTotal } from "@/tokenu/contracts/costLedgerPeriodTotal";
import { fromMoneyMicros, toMoneyMicros } from "@/tokenu/adapters/storage/moneyMicros";
import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type { CostLedgerRepository } from "@/tokenu/runtime/costLedgerRepository";

interface CostLedgerRow {
  readonly workspace_id: string;
  readonly request_id: string;
  readonly attempt_id: string;
  readonly provider_id: string;
  readonly model_id: string;
  readonly currency: string;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly total_tokens: number;
  readonly cost_micros: number;
  readonly created_at: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isCostLedgerRow(value: unknown): value is CostLedgerRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    isNonEmptyString(row.workspace_id) &&
    isNonEmptyString(row.request_id) &&
    isNonEmptyString(row.attempt_id) &&
    isNonEmptyString(row.provider_id) &&
    isNonEmptyString(row.model_id) &&
    isNonEmptyString(row.currency) &&
    isNonNegativeSafeInteger(row.input_tokens) &&
    isNonNegativeSafeInteger(row.output_tokens) &&
    isNonNegativeSafeInteger(row.total_tokens) &&
    isNonNegativeSafeInteger(row.cost_micros) &&
    isNonEmptyString(row.created_at)
  );
}

function toEntry(row: CostLedgerRow): CostLedgerEntry {
  return {
    workspaceId: row.workspace_id,
    requestId: row.request_id,
    attemptId: row.attempt_id,
    providerId: row.provider_id,
    modelId: row.model_id,
    currency: row.currency,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    cost: fromMoneyMicros(row.cost_micros),
    createdAt: row.created_at,
  };
}

function samePersistedEntry(
  row: CostLedgerRow,
  entry: CostLedgerEntry,
  costMicros: number
): boolean {
  return (
    row.workspace_id === entry.workspaceId &&
    row.request_id === entry.requestId &&
    row.attempt_id === entry.attemptId &&
    row.provider_id === entry.providerId &&
    row.model_id === entry.modelId &&
    row.currency === entry.currency &&
    row.input_tokens === entry.inputTokens &&
    row.output_tokens === entry.outputTokens &&
    row.total_tokens === entry.totalTokens &&
    row.cost_micros === costMicros &&
    row.created_at === entry.createdAt
  );
}

export class SqliteCostLedgerRepository implements CostLedgerRepository {
  constructor(private readonly database: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async append(entry: CostLedgerEntry): Promise<boolean> {
    const costMicros = toMoneyMicros(entry.cost);

    const result = this.database
      .prepare(
        `INSERT INTO tokenu_cost_ledger (
           workspace_id,
           request_id,
           attempt_id,
           provider_id,
           model_id,
           currency,
           input_tokens,
           output_tokens,
           total_tokens,
           cost_micros,
           created_at
         )
         VALUES (
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?
         )
         ON CONFLICT(
           workspace_id,
           attempt_id
         )
         DO NOTHING`
      )
      .run(
        entry.workspaceId,
        entry.requestId,
        entry.attemptId,
        entry.providerId,
        entry.modelId,
        entry.currency,
        entry.inputTokens,
        entry.outputTokens,
        entry.totalTokens,
        costMicros,
        entry.createdAt
      );

    if (result.changes === 1) {
      return true;
    }

    const existing = this.database
      .prepare(
        `SELECT
             workspace_id,
             request_id,
             attempt_id,
             provider_id,
             model_id,
             currency,
             input_tokens,
             output_tokens,
             total_tokens,
             cost_micros,
             created_at
           FROM tokenu_cost_ledger
           WHERE workspace_id = ?
             AND attempt_id = ?`
      )
      .get(entry.workspaceId, entry.attemptId);

    if (!isCostLedgerRow(existing)) {
      throw new Error("TokenU cost ledger conflict could not be resolved");
    }

    if (!samePersistedEntry(existing, entry, costMicros)) {
      throw new Error("TokenU cost ledger attempt already exists with different data");
    }

    return false;
  }

  async list(workspaceId: string): Promise<readonly CostLedgerEntry[]> {
    const statement = this.database.prepare(
      `SELECT
           workspace_id,
           request_id,
           attempt_id,
           provider_id,
           model_id,
           currency,
           input_tokens,
           output_tokens,
           total_tokens,
           cost_micros,
           created_at
         FROM tokenu_cost_ledger
         WHERE workspace_id = ?
         ORDER BY
           created_at ASC,
           attempt_id ASC`
    );

    if (!statement.all) {
      throw new Error("TokenU SQLite database does not support list queries");
    }

    const rows = statement.all(workspaceId);

    return rows.map((row) => {
      if (!isCostLedgerRow(row)) {
        throw new Error("Invalid TokenU cost ledger row");
      }

      return toEntry(row);
    });
  }

  async periodTotals(
    workspaceId: string,
    period: string
  ): Promise<readonly CostLedgerPeriodTotal[]> {
    const statement = this.database.prepare(
      `SELECT
           currency,
           COUNT(*) AS execution_count,
           SUM(cost_micros)
             AS total_cost_micros
         FROM tokenu_cost_ledger
         WHERE workspace_id = ?
           AND substr(
             created_at,
             1,
             7
           ) = ?
         GROUP BY currency
         ORDER BY currency ASC`
    );

    if (!statement.all) {
      throw new Error("TokenU SQLite database does not support list queries");
    }

    return statement.all(workspaceId, period).map((row) => {
      if (row === null || typeof row !== "object" || Array.isArray(row)) {
        throw new Error("Invalid TokenU cost ledger period total");
      }

      const record = row as Record<string, unknown>;

      const currency = record.currency;

      const executionCount = record.execution_count;

      const totalCostMicros = record.total_cost_micros;

      if (
        !isNonEmptyString(currency) ||
        !isNonNegativeSafeInteger(executionCount) ||
        !isNonNegativeSafeInteger(totalCostMicros)
      ) {
        throw new Error("Invalid TokenU cost ledger period total");
      }

      return {
        currency,
        executionCount,
        totalCost: fromMoneyMicros(totalCostMicros),
      };
    });
  }

  async totalCost(workspaceId: string): Promise<number> {
    const row = this.database
      .prepare(
        `SELECT
             COALESCE(
               SUM(cost_micros),
               0
             ) AS total_cost_micros
           FROM tokenu_cost_ledger
           WHERE workspace_id = ?`
      )
      .get(workspaceId);

    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Invalid TokenU cost ledger total");
    }

    const total = (row as Record<string, unknown>).total_cost_micros;

    if (!isNonNegativeSafeInteger(total)) {
      throw new Error("Invalid TokenU cost ledger total");
    }

    return fromMoneyMicros(total);
  }
}
