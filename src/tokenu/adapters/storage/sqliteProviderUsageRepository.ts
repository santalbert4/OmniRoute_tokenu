import type { ProviderUsageRecord } from "@/tokenu/contracts/providerUsageRecord";
import { fromMoneyMicros, toMoneyMicros } from "@/tokenu/adapters/storage/moneyMicros";
import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type {
  ProviderUsageIncrement,
  ProviderUsageRepository,
} from "@/tokenu/runtime/providerUsageRepository";

interface ProviderUsageRow {
  readonly workspace_id: string;
  readonly period: string;
  readonly provider_id: string;
  readonly model_id: string;
  readonly request_count: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly estimated_cost_micros: number;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isProviderUsageRow(value: unknown): value is ProviderUsageRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.workspace_id === "string" &&
    row.workspace_id.trim().length > 0 &&
    typeof row.period === "string" &&
    row.period.trim().length > 0 &&
    typeof row.provider_id === "string" &&
    row.provider_id.trim().length > 0 &&
    typeof row.model_id === "string" &&
    row.model_id.trim().length > 0 &&
    isNonNegativeSafeInteger(row.request_count) &&
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

function mapProviderUsageRow(value: unknown): ProviderUsageRecord {
  if (!isProviderUsageRow(value)) {
    throw new Error("Invalid TokenU provider usage row");
  }

  return {
    workspaceId: value.workspace_id,
    period: value.period,
    providerId: value.provider_id,
    modelId: value.model_id,
    requestCount: value.request_count,
    inputTokens: value.input_tokens,
    outputTokens: value.output_tokens,
    estimatedCost: fromMoneyMicros(value.estimated_cost_micros),
  };
}

export class SqliteProviderUsageRepository implements ProviderUsageRepository {
  constructor(private readonly db: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async get(
    workspaceId: string,
    period: string,
    providerId: string,
    modelId: string
  ): Promise<ProviderUsageRecord | null> {
    const row = this.db
      .prepare(
        `SELECT
           workspace_id,
           period,
           provider_id,
           model_id,
           request_count,
           input_tokens,
           output_tokens,
           estimated_cost_micros
         FROM tokenu_provider_usage
         WHERE workspace_id = ?
           AND period = ?
           AND provider_id = ?
           AND model_id = ?`
      )
      .get(workspaceId, period, providerId, modelId);

    if (!row) {
      return null;
    }

    return mapProviderUsageRow(row);
  }

  async list(workspaceId: string, period: string): Promise<readonly ProviderUsageRecord[]> {
    const statement = this.db.prepare(
      `SELECT
         workspace_id,
         period,
         provider_id,
         model_id,
         request_count,
         input_tokens,
         output_tokens,
         estimated_cost_micros
       FROM tokenu_provider_usage
       WHERE workspace_id = ?
         AND period = ?
       ORDER BY provider_id, model_id`
    );

    if (!statement.all) {
      throw new Error("TokenU SQLite database does not support list queries");
    }

    return statement.all(workspaceId, period).map(mapProviderUsageRow);
  }

  async save(usage: ProviderUsageRecord): Promise<void> {
    assertUsageCounter(usage.requestCount, "provider request count");

    assertUsageCounter(usage.inputTokens, "provider input token count");

    assertUsageCounter(usage.outputTokens, "provider output token count");

    this.db
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
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(
           workspace_id,
           period,
           provider_id,
           model_id
         )
         DO UPDATE SET
           request_count =
             excluded.request_count,
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
        usage.providerId,
        usage.modelId,
        usage.requestCount,
        usage.inputTokens,
        usage.outputTokens,
        toMoneyMicros(usage.estimatedCost)
      );
  }

  async increment(
    workspaceId: string,
    period: string,
    providerId: string,
    modelId: string,
    delta: ProviderUsageIncrement
  ): Promise<void> {
    assertUsageCounter(delta.inputTokens, "provider input token delta");

    assertUsageCounter(delta.outputTokens, "provider output token delta");

    this.db
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
        workspaceId,
        period,
        providerId,
        modelId,
        delta.inputTokens,
        delta.outputTokens,
        toMoneyMicros(delta.estimatedCost)
      );
  }
}
