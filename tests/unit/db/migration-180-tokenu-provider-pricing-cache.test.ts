import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

interface RawStatement {
  get(...params: unknown[]): unknown;

  run(...params: unknown[]): {
    readonly changes?: number;
  };
}

interface RawDatabase {
  exec(sql: string): void;
  prepare(sql: string): RawStatement;
  close(): void;
}

const require = createRequire(import.meta.url);

const BetterSqlite3 = require("better-sqlite3") as new (filename: string) => RawDatabase;

function createDatabase(): RawDatabase {
  const db = new BetterSqlite3(":memory:");

  db.exec(fs.readFileSync("src/lib/db/migrations/177_tokenu_provider_pricing.sql", "utf8"));

  db.exec(fs.readFileSync("src/lib/db/migrations/180_tokenu_provider_pricing_cache.sql", "utf8"));

  return db;
}

test("migration 180 preserves historical rows with null cache prices", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  db.prepare(
    `INSERT INTO tokenu_provider_pricing (
       provider_id,
       model_id,
       currency,
       input_token_price_per_million_micros,
       output_token_price_per_million_micros,
       effective_from
     )
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run("legacy-provider", "legacy-model", "USD", 200000, 800000, "2026-01-01T00:00:00.000Z");

  const row = db
    .prepare(
      `SELECT
         cache_read_token_price_per_million_micros,
         cache_write_token_price_per_million_micros
       FROM tokenu_provider_pricing
       WHERE provider_id = ?`
    )
    .get("legacy-provider");

  assert.deepEqual(row, {
    cache_read_token_price_per_million_micros: null,
    cache_write_token_price_per_million_micros: null,
  });
});

test("migration 180 stores cache prices as integer micros", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  db.prepare(
    `INSERT INTO tokenu_provider_pricing (
       provider_id,
       model_id,
       currency,
       input_token_price_per_million_micros,
       output_token_price_per_million_micros,
       cache_read_token_price_per_million_micros,
       cache_write_token_price_per_million_micros,
       effective_from
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "groq",
    "openai/gpt-oss-20b",
    "USD",
    75000,
    300000,
    37000,
    null,
    "2026-09-09T00:00:00.000Z"
  );

  const row = db
    .prepare(
      `SELECT
         cache_read_token_price_per_million_micros,
         cache_write_token_price_per_million_micros,
         typeof(
           cache_read_token_price_per_million_micros
         ) AS cache_read_type
       FROM tokenu_provider_pricing
       WHERE provider_id = ?`
    )
    .get("groq");

  assert.deepEqual(row, {
    cache_read_token_price_per_million_micros: 37000,
    cache_write_token_price_per_million_micros: null,
    cache_read_type: "integer",
  });
});

test("migration 180 rejects negative and fractional cache prices", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const insert = db.prepare(
    `INSERT INTO tokenu_provider_pricing (
       provider_id,
       model_id,
       currency,
       input_token_price_per_million_micros,
       output_token_price_per_million_micros,
       cache_read_token_price_per_million_micros,
       cache_write_token_price_per_million_micros,
       effective_from
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  assert.throws(
    () => insert.run("groq", "bad-negative", "USD", 1, 1, -1, null, "2026-09-09T00:00:00.000Z"),
    /CHECK constraint failed/
  );

  assert.throws(
    () => insert.run("groq", "bad-fraction", "USD", 1, 1, 0.5, null, "2026-09-09T00:00:00.000Z"),
    /CHECK constraint failed/
  );
});
