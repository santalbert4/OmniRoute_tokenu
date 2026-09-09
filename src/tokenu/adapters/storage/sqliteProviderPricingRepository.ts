import type { ProviderPricing } from "@/tokenu/contracts/providerPricing";
import { fromMoneyMicros, toMoneyMicros } from "@/tokenu/adapters/storage/moneyMicros";
import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type { ProviderPricingRepository } from "@/tokenu/runtime/providerPricingRepository";

interface ProviderPricingRow {
  readonly provider_id: string;
  readonly model_id: string;
  readonly currency: string;
  readonly input_token_price_per_million_micros: number;
  readonly output_token_price_per_million_micros: number;
  readonly effective_from: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function canonicalTimestamp(value: string): string {
  const milliseconds = Date.parse(value);

  if (!Number.isFinite(milliseconds)) {
    throw new Error("Invalid TokenU pricing timestamp");
  }

  return new Date(milliseconds).toISOString();
}

function isProviderPricingRow(value: unknown): value is ProviderPricingRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    isNonEmptyString(row.provider_id) &&
    isNonEmptyString(row.model_id) &&
    isNonEmptyString(row.currency) &&
    isNonNegativeSafeInteger(row.input_token_price_per_million_micros) &&
    isNonNegativeSafeInteger(row.output_token_price_per_million_micros) &&
    isNonEmptyString(row.effective_from)
  );
}

function toPricing(row: ProviderPricingRow): ProviderPricing {
  return {
    providerId: row.provider_id,
    modelId: row.model_id,
    currency: row.currency,
    inputTokenPricePerMillion: fromMoneyMicros(row.input_token_price_per_million_micros),
    outputTokenPricePerMillion: fromMoneyMicros(row.output_token_price_per_million_micros),
    effectiveFrom: row.effective_from,
  };
}

export class SqliteProviderPricingRepository implements ProviderPricingRepository {
  constructor(private readonly database: TokenUSqliteDatabase = getTokenUSqliteDatabase()) {}

  async save(pricing: ProviderPricing): Promise<void> {
    const effectiveFrom = canonicalTimestamp(pricing.effectiveFrom);

    this.database
      .prepare(
        `INSERT INTO tokenu_provider_pricing (
           provider_id,
           model_id,
           currency,
           input_token_price_per_million_micros,
           output_token_price_per_million_micros,
           effective_from
         )
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(
           provider_id,
           model_id,
           effective_from
         )
         DO UPDATE SET
           currency =
             excluded.currency,
           input_token_price_per_million_micros =
             excluded.input_token_price_per_million_micros,
           output_token_price_per_million_micros =
             excluded.output_token_price_per_million_micros`
      )
      .run(
        pricing.providerId,
        pricing.modelId,
        pricing.currency,
        toMoneyMicros(pricing.inputTokenPricePerMillion),
        toMoneyMicros(pricing.outputTokenPricePerMillion),
        effectiveFrom
      );
  }

  async list(): Promise<readonly ProviderPricing[]> {
    const statement = this.database.prepare(
      `SELECT
           provider_id,
           model_id,
           currency,
           input_token_price_per_million_micros,
           output_token_price_per_million_micros,
           effective_from
         FROM tokenu_provider_pricing
         ORDER BY
           provider_id ASC,
           model_id ASC,
           effective_from ASC`
    );

    if (!statement.all) {
      throw new Error("TokenU SQLite database does not support list queries");
    }

    return statement.all().map((row) => {
      if (!isProviderPricingRow(row)) {
        throw new Error("Invalid TokenU provider pricing row");
      }

      return toPricing(row);
    });
  }

  async findEffective(
    providerId: string,
    modelId: string,
    effectiveAt: string
  ): Promise<ProviderPricing | null> {
    const row = this.database
      .prepare(
        `SELECT
           provider_id,
           model_id,
           currency,
           input_token_price_per_million_micros,
           output_token_price_per_million_micros,
           effective_from
         FROM tokenu_provider_pricing
         WHERE provider_id = ?
           AND model_id = ?
           AND effective_from <= ?
         ORDER BY effective_from DESC
         LIMIT 1`
      )
      .get(providerId, modelId, canonicalTimestamp(effectiveAt));

    if (!row) {
      return null;
    }

    if (!isProviderPricingRow(row)) {
      throw new Error("Invalid TokenU provider pricing row");
    }

    return toPricing(row);
  }
}
