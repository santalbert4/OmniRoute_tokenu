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
    "175_tokenu_usage_metering.sql",
    "178_tokenu_usage_projection_attempts.sql",
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

const INSERT = `
  INSERT INTO tokenu_usage_projection_attempts (
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
`;

test("migration 178 stores usage projection attempt identity using integer micros", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  db.prepare(INSERT).run(
    "workspace-a",
    "request-1",
    "attempt-1",
    "2026-09",
    "groq",
    "llama-test",
    1000,
    500,
    600,
    "2026-09-09T10:00:00.000Z"
  );

  const row = db
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
         typeof(estimated_cost_micros) AS cost_type,
         recorded_at
       FROM tokenu_usage_projection_attempts
       WHERE workspace_id = ?
         AND attempt_id = ?`
    )
    .get("workspace-a", "attempt-1");

  assert.deepEqual(row, {
    workspace_id: "workspace-a",
    request_id: "request-1",
    attempt_id: "attempt-1",
    period: "2026-09",
    provider_id: "groq",
    model_id: "llama-test",
    input_tokens: 1000,
    output_tokens: 500,
    estimated_cost_micros: 600,
    cost_type: "integer",
    recorded_at: "2026-09-09T10:00:00.000Z",
  });
});

test("migration 178 scopes projection attempt identity by workspace", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const insert = db.prepare(INSERT);

  insert.run(
    "workspace-a",
    "request-1",
    "attempt-shared",
    "2026-09",
    "groq",
    "llama-test",
    100,
    50,
    100,
    "2026-09-09T10:00:00.000Z"
  );

  assert.throws(
    () =>
      insert.run(
        "workspace-a",
        "request-2",
        "attempt-shared",
        "2026-09",
        "openai",
        "gpt-test",
        200,
        100,
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
      "2026-09",
      "openai",
      "gpt-test",
      200,
      100,
      200,
      "2026-09-09T10:01:00.000Z"
    )
  );
});

test("migration 178 rejects invalid projection identity and unknown workspaces", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const insert = db.prepare(INSERT);

  assert.throws(
    () =>
      insert.run(
        "workspace-missing",
        "request-1",
        "attempt-1",
        "2026-09",
        "groq",
        "llama-test",
        100,
        50,
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
        "2026-09",
        "groq",
        "llama-test",
        100,
        50,
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
        "attempt-negative",
        "2026-09",
        "groq",
        "llama-test",
        -1,
        50,
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
        "attempt-money",
        "2026-09",
        "groq",
        "llama-test",
        100,
        50,
        0.5,
        "2026-09-09T10:00:00.000Z"
      ),
    /CHECK constraint failed/
  );
});

test("migration 178 prevents deleting workspace with projection history", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  db.prepare(INSERT).run(
    "workspace-a",
    "request-1",
    "attempt-1",
    "2026-09",
    "groq",
    "llama-test",
    100,
    50,
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
    /tokenu_workspace_has_usage_projection/
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
