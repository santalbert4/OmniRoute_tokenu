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

  for (const migration of [
    "173_tokenu_workspace_identity.sql",
    "174_tokenu_workspace_plans.sql",
    "175_tokenu_usage_metering.sql",
    "176_tokenu_cost_ledger.sql",
  ]) {
    db.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  const insertWorkspace = db.prepare(
    `INSERT INTO tokenu_workspaces (
       id,
       created_at
     )
     VALUES (?, ?)`
  );

  insertWorkspace.run("workspace-a", "2026-09-09T00:00:00.000Z");

  insertWorkspace.run("workspace-b", "2026-09-09T00:00:00.000Z");

  return db;
}

test("migration 176 stores authoritative cost ledger entries using integer micros", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const insert = db.prepare(
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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insert.run(
    "workspace-a",
    "request-1",
    "attempt-1",
    "groq",
    "llama-test",
    "USD",
    1000,
    500,
    1500,
    600,
    "2026-09-09T10:00:00.000Z"
  );

  insert.run(
    "workspace-a",
    "request-1",
    "attempt-2",
    "openai",
    "gpt-test",
    "USD",
    2000,
    1000,
    3000,
    3000,
    "2026-09-09T10:01:00.000Z"
  );

  const row = db
    .prepare(
      `SELECT
       workspace_id,
       request_id,
       attempt_id,
       cost_micros,
       typeof(cost_micros) AS cost_type
     FROM tokenu_cost_ledger
     WHERE workspace_id = ?
       AND attempt_id = ?`
    )
    .get("workspace-a", "attempt-1") as {
    workspace_id: string;
    request_id: string;
    attempt_id: string;
    cost_micros: number;
    cost_type: string;
  };

  assert.deepEqual(row, {
    workspace_id: "workspace-a",
    request_id: "request-1",
    attempt_id: "attempt-1",
    cost_micros: 600,
    cost_type: "integer",
  });

  const count = db
    .prepare(
      `SELECT COUNT(*) AS count
     FROM tokenu_cost_ledger
     WHERE workspace_id = ?
       AND request_id = ?`
    )
    .get("workspace-a", "request-1") as {
    count: number;
  };

  assert.equal(count.count, 2);
});

test("migration 176 enforces workspace plus attempt idempotency identity", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const insert = db.prepare(
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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insert.run(
    "workspace-a",
    "request-1",
    "attempt-shared",
    "groq",
    "llama-test",
    "USD",
    100,
    50,
    150,
    100,
    "2026-09-09T10:00:00.000Z"
  );

  assert.throws(
    () =>
      insert.run(
        "workspace-a",
        "request-2",
        "attempt-shared",
        "openai",
        "gpt-test",
        "USD",
        200,
        100,
        300,
        200,
        "2026-09-09T10:01:00.000Z"
      ),
    /UNIQUE constraint failed/
  );

  assert.doesNotThrow(() =>
    insert.run(
      "workspace-b",
      "request-2",
      "attempt-shared",
      "openai",
      "gpt-test",
      "USD",
      200,
      100,
      300,
      200,
      "2026-09-09T10:01:00.000Z"
    )
  );
});

test("migration 176 rejects invalid ledger rows and unknown workspaces", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const insert = db.prepare(
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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  assert.throws(
    () =>
      insert.run(
        "workspace-missing",
        "request-1",
        "attempt-1",
        "groq",
        "llama-test",
        "USD",
        100,
        50,
        150,
        100,
        "2026-09-09T10:00:00.000Z"
      ),
    /tokenu_workspace_not_found/
  );

  assert.throws(
    () =>
      insert.run(
        "workspace-a",
        "request-1",
        "",
        "groq",
        "llama-test",
        "USD",
        100,
        50,
        150,
        100,
        "2026-09-09T10:00:00.000Z"
      ),
    /CHECK constraint failed/
  );

  assert.throws(
    () =>
      insert.run(
        "workspace-a",
        "request-1",
        "attempt-2",
        "groq",
        "llama-test",
        "USD",
        100,
        50,
        150,
        -1,
        "2026-09-09T10:00:00.000Z"
      ),
    /CHECK constraint failed/
  );

  assert.throws(
    () =>
      insert.run(
        "workspace-a",
        "request-1",
        "attempt-3",
        "groq",
        "llama-test",
        "USD",
        100,
        50,
        150,
        0.5,
        "2026-09-09T10:00:00.000Z"
      ),
    /CHECK constraint failed/
  );
});

test("migration 176 prevents deleting workspaces with ledger history", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  db.prepare(
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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "workspace-a",
    "request-1",
    "attempt-1",
    "groq",
    "llama-test",
    "USD",
    100,
    50,
    150,
    100,
    "2026-09-09T10:00:00.000Z"
  );

  assert.throws(
    () =>
      db
        .prepare(
          `DELETE FROM tokenu_workspaces
         WHERE id = ?`
        )
        .run("workspace-a"),
    /tokenu_workspace_has_cost_ledger/
  );

  assert.doesNotThrow(() =>
    db
      .prepare(
        `DELETE FROM tokenu_workspaces
         WHERE id = ?`
      )
      .run("workspace-b")
  );
});
