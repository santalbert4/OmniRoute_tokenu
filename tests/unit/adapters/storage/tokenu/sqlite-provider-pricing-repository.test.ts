import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { SqliteProviderPricingRepository } from "@/tokenu/adapters/storage/sqliteProviderPricingRepository";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";

interface RawStatement {
  get(...params: unknown[]): unknown;

  all(...params: unknown[]): readonly unknown[];

  run(...params: unknown[]): {
    readonly changes?: number;
  };
}

interface RawDatabase {
  exec(sql: string): void;

  prepare(sql: string): RawStatement;

  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T;

  close(): void;
}

const require = createRequire(import.meta.url);

const BetterSqlite3 = require("better-sqlite3") as new (filename: string) => RawDatabase;

function createDatabase(): RawDatabase {
  const db = new BetterSqlite3(":memory:");

  db.exec(fs.readFileSync("src/lib/db/migrations/177_tokenu_provider_pricing.sql", "utf8"));

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db as TokenUSqliteDatabase;
}

test("SQLite provider pricing persists integer micros and normalizes effective timestamp", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteProviderPricingRepository(asTokenUDatabase(db));

  await repository.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokenPricePerMillion: 0.2,
    outputTokenPricePerMillion: 0.8,
    effectiveFrom: "2026-09-01T02:00:00+02:00",
  });

  const raw = db
    .prepare(
      `SELECT
         input_token_price_per_million_micros,
         output_token_price_per_million_micros,
         effective_from,
         typeof(
           input_token_price_per_million_micros
         ) AS input_type,
         typeof(
           output_token_price_per_million_micros
         ) AS output_type
       FROM tokenu_provider_pricing
       WHERE provider_id = ?
         AND model_id = ?`
    )
    .get("groq", "llama-test") as {
    input_token_price_per_million_micros: number;
    output_token_price_per_million_micros: number;
    effective_from: string;
    input_type: string;
    output_type: string;
  };

  assert.deepEqual(raw, {
    input_token_price_per_million_micros: 200000,
    output_token_price_per_million_micros: 800000,
    effective_from: "2026-09-01T00:00:00.000Z",
    input_type: "integer",
    output_type: "integer",
  });
});

test("SQLite provider pricing selects latest version effective at execution time", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteProviderPricingRepository(asTokenUDatabase(db));

  await repository.save({
    providerId: "openai",
    modelId: "gpt-test",
    currency: "USD",
    inputTokenPricePerMillion: 2,
    outputTokenPricePerMillion: 8,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
  });

  await repository.save({
    providerId: "openai",
    modelId: "gpt-test",
    currency: "USD",
    inputTokenPricePerMillion: 1.5,
    outputTokenPricePerMillion: 6,
    effectiveFrom: "2026-06-01T00:00:00.000Z",
  });

  await repository.save({
    providerId: "openai",
    modelId: "gpt-test",
    currency: "USD",
    inputTokenPricePerMillion: 1,
    outputTokenPricePerMillion: 5,
    effectiveFrom: "2026-10-01T00:00:00.000Z",
  });

  const september = await repository.findEffective(
    "openai",
    "gpt-test",
    "2026-09-15T12:00:00+02:00"
  );

  assert.deepEqual(september, {
    providerId: "openai",
    modelId: "gpt-test",
    currency: "USD",
    inputTokenPricePerMillion: 1.5,
    outputTokenPricePerMillion: 6,
    effectiveFrom: "2026-06-01T00:00:00.000Z",
  });

  const october = await repository.findEffective("openai", "gpt-test", "2026-10-15T12:00:00.000Z");

  assert.equal(october?.inputTokenPricePerMillion, 1);
});

test("SQLite provider pricing returns null before first effective version", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteProviderPricingRepository(asTokenUDatabase(db));

  await repository.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokenPricePerMillion: 0.2,
    outputTokenPricePerMillion: 0.8,
    effectiveFrom: "2026-06-01T00:00:00.000Z",
  });

  assert.equal(
    await repository.findEffective("groq", "llama-test", "2026-05-31T23:59:59.999Z"),
    null
  );
});

test("SQLite provider pricing updates the same logical version without adding history", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteProviderPricingRepository(asTokenUDatabase(db));

  await repository.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokenPricePerMillion: 0.2,
    outputTokenPricePerMillion: 0.8,
    effectiveFrom: "2026-09-01T00:00:00.000Z",
  });

  await repository.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "EUR",
    inputTokenPricePerMillion: 0.25,
    outputTokenPricePerMillion: 0.9,
    effectiveFrom: "2026-09-01T02:00:00+02:00",
  });

  const records = await repository.list();

  assert.deepEqual(records, [
    {
      providerId: "groq",
      modelId: "llama-test",
      currency: "EUR",
      inputTokenPricePerMillion: 0.25,
      outputTokenPricePerMillion: 0.9,
      effectiveFrom: "2026-09-01T00:00:00.000Z",
    },
  ]);
});

test("SQLite provider pricing rejects invalid timestamps and money", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteProviderPricingRepository(asTokenUDatabase(db));

  await assert.rejects(
    repository.save({
      providerId: "groq",
      modelId: "llama-test",
      currency: "USD",
      inputTokenPricePerMillion: 0.2,
      outputTokenPricePerMillion: 0.8,
      effectiveFrom: "not-a-date",
    }),
    /Invalid TokenU pricing timestamp/
  );

  await assert.rejects(
    repository.save({
      providerId: "groq",
      modelId: "llama-test",
      currency: "USD",
      inputTokenPricePerMillion: -1,
      outputTokenPricePerMillion: 0.8,
      effectiveFrom: "2026-09-01T00:00:00.000Z",
    }),
    /TokenU money amount/
  );

  await assert.rejects(
    repository.findEffective("groq", "llama-test", "not-a-date"),
    /Invalid TokenU pricing timestamp/
  );
});
