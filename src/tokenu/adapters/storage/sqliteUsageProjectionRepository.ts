import type { UsageProjectionAttempt } from "@/tokenu/contracts/usageProjectionAttempt";
import { toMoneyMicros } from "@/tokenu/adapters/storage/moneyMicros";
import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type { UsageProjectionRepository } from "@/tokenu/runtime/usageProjectionRepository";

interface UsageProjectionAttemptRow {
  readonly workspace_id: string;
  readonly request_id: string;
  readonly attempt_id: string;
  readonly period: string;
  readonly provider_id: string;
  readonly model_id: string;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly estimated_cost_micros: number;
  readonly recorded_at: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isUsageProjectionAttemptRow(value: unknown): value is UsageProjectionAttemptRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    isNonEmptyString(row.workspace_id) &&
    isNonEmptyString(row.request_id) &&
    isNonEmptyString(row.attempt_id) &&
    isNonEmptyString(row.period) &&
    isNonEmptyString(row.provider_id) &&
    isNonEmptyString(row.model_id) &&
    isNonNegativeSafeInteger(row.input_tokens) &&
    isNonNegativeSafeInteger(row.output_tokens) &&
    isNonNegativeSafeInteger(row.estimated_cost_micros) &&
    isNonEmptyString(row.recorded_at)
  );
}

function assertNonEmpty(value: string, name: string): void {
  if (value.trim().length === 0) {
    throw new Error(`TokenU usage projection requires ${name}`);
  }
}

function assertCounter(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`TokenU ${name} must be a non-negative safe integer`);
  }
}

function assertPeriod(period: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new Error("TokenU usage projection period must use YYYY-MM");
  }
}

function samePersistedAttemptIdentity(
  row: UsageProjectionAttemptRow,
  attempt: UsageProjectionAttempt
): boolean {
  return (
    row.workspace_id === attempt.workspaceId &&
    row.request_id === attempt.requestId &&
    row.attempt_id === attempt.attemptId &&
    row.period === attempt.period &&
    row.provider_id === attempt.providerId &&
    row.model_id === attempt.modelId &&
    row.input_tokens === attempt.inputTokens &&
    row.output_tokens === attempt.outputTokens &&
    row.recorded_at === attempt.recordedAt
  );
}

/**
 * Atomically projects one completed attempt into both persistent analytical
 * usage aggregates.
 *
 * The identity row and both aggregate increments commit together. Redelivery
 * of identical attempt data is a no-op. Reuse of the same workspace +
 * attemptId with different data fails closed.
 */
export class SqliteUsageProjectionRepository implements UsageProjectionRepository {
  constructor(private readonly database: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async projectAttempt(attempt: UsageProjectionAttempt): Promise<boolean> {
    assertNonEmpty(attempt.workspaceId, "workspace identity");
    assertNonEmpty(attempt.requestId, "request identity");
    assertNonEmpty(attempt.attemptId, "attempt identity");
    assertPeriod(attempt.period);
    assertNonEmpty(attempt.providerId, "provider identity");
    assertNonEmpty(attempt.modelId, "model identity");
    assertNonEmpty(attempt.recordedAt, "recorded timestamp");

    assertCounter(attempt.inputTokens, "usage projection input token count");
    assertCounter(attempt.outputTokens, "usage projection output token count");

    const estimatedCostMicros = toMoneyMicros(attempt.estimatedCost);

    const project = this.database.transaction(() => {
      const inserted = this.database
        .prepare(
          `INSERT INTO tokenu_usage_projection_attempts (
             workspace_id,
             request_id,
             attempt_id,
             period,
             provider_id,
             model_id,
             input_tokens,
             output_tokens,
             estimated_cost_micros,
             recorded_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(
             workspace_id,
             attempt_id
           )
           DO NOTHING`
        )
        .run(
          attempt.workspaceId,
          attempt.requestId,
          attempt.attemptId,
          attempt.period,
          attempt.providerId,
          attempt.modelId,
          attempt.inputTokens,
          attempt.outputTokens,
          estimatedCostMicros,
          attempt.recordedAt
        );

      if (inserted.changes !== 1) {
        const existing = this.database
          .prepare(
            `SELECT
               workspace_id,
               request_id,
               attempt_id,
               period,
               provider_id,
               model_id,
               input_tokens,
               output_tokens,
               estimated_cost_micros,
               recorded_at
             FROM tokenu_usage_projection_attempts
             WHERE workspace_id = ?
               AND attempt_id = ?`
          )
          .get(attempt.workspaceId, attempt.attemptId);

        if (!isUsageProjectionAttemptRow(existing)) {
          throw new Error("TokenU usage projection conflict could not be resolved");
        }

        if (!samePersistedAttemptIdentity(existing, attempt)) {
          throw new Error(
            "TokenU usage projection attempt already exists with different immutable data"
          );
        }

        return false;
      }

      this.database
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
          attempt.workspaceId,
          attempt.period,
          attempt.inputTokens,
          attempt.outputTokens,
          estimatedCostMicros
        );

      this.database
        .prepare(
          `INSERT INTO tokenu_provider_usage (
             workspace_id,
             period,
             provider_id,
             model_id,
             request_count,
             input_tokens,
             output_tokens,
             estimated_cost_micros
           )
           VALUES (?, ?, ?, ?, 1, ?, ?, ?)
           ON CONFLICT(
             workspace_id,
             period,
             provider_id,
             model_id
           )
           DO UPDATE SET
             request_count =
               tokenu_provider_usage.request_count + 1,
             input_tokens =
               tokenu_provider_usage.input_tokens +
               excluded.input_tokens,
             output_tokens =
               tokenu_provider_usage.output_tokens +
               excluded.output_tokens,
             estimated_cost_micros =
               tokenu_provider_usage.estimated_cost_micros +
               excluded.estimated_cost_micros`
        )
        .run(
          attempt.workspaceId,
          attempt.period,
          attempt.providerId,
          attempt.modelId,
          attempt.inputTokens,
          attempt.outputTokens,
          estimatedCostMicros
        );

      return true;
    });

    return project();
  }
}
