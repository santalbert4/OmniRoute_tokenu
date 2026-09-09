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

  return db;
}

const INSERT = `
  INSERT INTO tokenu_provider_pricing (
    provider_id,
    model_id,
    currency,
    input_token_price_per_million_micros,
    output_token_price_per_million_micros,
    effective_from
  )
  VALUES (?, ?, ?, ?, ?, ?)
`;

test("migration 177 stores versioned provider pricing using integer micros", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const insert = db.prepare(INSERT);

  insert.run("groq", "llama-test", "USD", 200000, 800000, "2026-01-01T00:00:00.000Z");

  insert.run("groq", "llama-test", "USD", 100000, 400000, "2026-10-01T00:00:00.000Z");

  const row = db
    .prepare(
      `SELECT
         provider_id,
         model_id,
         currency,
         input_token_price_per_million_micros,
         output_token_price_per_million_micros,
         effective_from,
         typeof(input_token_price_per_million_micros) AS input_type,
         typeof(output_token_price_per_million_micros) AS output_type
       FROM tokenu_provider_pricing
       WHERE provider_id = ?
         AND model_id = ?
         AND effective_from <= ?
       ORDER BY effective_from DESC
       LIMIT 1`
    )
    .get("groq", "llama-test", "2026-09-15T12:00:00.000Z") as {
    provider_id: string;
    model_id: string;
    currency: string;
    input_token_price_per_million_micros: number;
    output_token_price_per_million_micros: number;
    effective_from: string;
    input_type: string;
    output_type: string;
  };

  assert.deepEqual(row, {
    provider_id: "groq",
    model_id: "llama-test",
    currency: "USD",
    input_token_price_per_million_micros: 200000,
    output_token_price_per_million_micros: 800000,
    effective_from: "2026-01-01T00:00:00.000Z",
    input_type: "integer",
    output_type: "integer",
  });
});

test("migration 177 versions pricing by provider model and effective timestamp", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const insert = db.prepare(INSERT);

  insert.run("openai", "gpt-test", "USD", 2000000, 8000000, "2026-06-01T00:00:00.000Z");

  insert.run("openai", "gpt-test", "USD", 1500000, 6000000, "2026-09-01T00:00:00.000Z");

  assert.throws(
    () => insert.run("openai", "gpt-test", "USD", 1000000, 5000000, "2026-09-01T00:00:00.000Z"),
    /UNIQUE constraint failed/
  );

  assert.doesNotThrow(() =>
    insert.run("groq", "gpt-test", "USD", 100000, 200000, "2026-09-01T00:00:00.000Z")
  );
});

test("migration 177 rejects invalid identifiers and monetary values", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const insert = db.prepare(INSERT);

  assert.throws(
    () => insert.run("", "model", "USD", 1, 1, "2026-09-01T00:00:00.000Z"),
    /CHECK constraint failed/
  );

  assert.throws(
    () => insert.run("groq", "", "USD", 1, 1, "2026-09-01T00:00:00.000Z"),
    /CHECK constraint failed/
  );

  assert.throws(
    () => insert.run("groq", "model", "", 1, 1, "2026-09-01T00:00:00.000Z"),
    /CHECK constraint failed/
  );

  assert.throws(
    () => insert.run("groq", "model", "USD", -1, 1, "2026-09-01T00:00:00.000Z"),
    /CHECK constraint failed/
  );

  assert.throws(
    () => insert.run("groq", "model", "USD", 0.5, 1, "2026-09-01T00:00:00.000Z"),
    /CHECK constraint failed/
  );

  assert.throws(() => insert.run("groq", "model", "USD", 1, 1, ""), /CHECK constraint failed/);
});
