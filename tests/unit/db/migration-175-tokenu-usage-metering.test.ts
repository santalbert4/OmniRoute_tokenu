import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

interface RawStatement {
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
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
  ]) {
    db.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  db.prepare(
    `INSERT INTO tokenu_workspaces (
       id,
       created_at
     )
     VALUES (?, ?)`
  ).run("workspace-a", "2026-09-09T00:00:00.000Z");

  return db;
}

test("migration 175 supports atomic usage accumulation", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const incrementRequests = db.prepare(
    `INSERT INTO tokenu_workspace_request_usage (
       workspace_id,
       period,
       request_count
     )
     VALUES (?, ?, 1)
     ON CONFLICT(workspace_id, period)
     DO UPDATE SET
       request_count =
         tokenu_workspace_request_usage.request_count + 1`
  );

  incrementRequests.run("workspace-a", "2026-09");
  incrementRequests.run("workspace-a", "2026-09");

  const requests = db
    .prepare(
      `SELECT request_count
     FROM tokenu_workspace_request_usage
     WHERE workspace_id = ?
       AND period = ?`
    )
    .get("workspace-a", "2026-09") as {
    request_count: number;
  };

  assert.equal(requests.request_count, 2);

  const incrementWorkspace = db.prepare(
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
  );

  incrementWorkspace.run("workspace-a", "2026-09", 1000, 500, 50_000);

  incrementWorkspace.run("workspace-a", "2026-09", 2000, 1000, 100_000);

  const workspaceUsage = db
    .prepare(
      `SELECT
       metered_execution_count,
       input_tokens,
       output_tokens,
       estimated_cost_micros
     FROM tokenu_workspace_usage_metering
     WHERE workspace_id = ?
       AND period = ?`
    )
    .get("workspace-a", "2026-09") as {
    metered_execution_count: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_micros: number;
  };

  assert.deepEqual(workspaceUsage, {
    metered_execution_count: 2,
    input_tokens: 3000,
    output_tokens: 1500,
    estimated_cost_micros: 150_000,
  });

  const incrementProvider = db.prepare(
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
  );

  incrementProvider.run("workspace-a", "2026-09", "openai", "gpt-5", 1000, 500, 50_000);

  incrementProvider.run("workspace-a", "2026-09", "openai", "gpt-5", 2000, 1000, 100_000);

  const providerUsage = db
    .prepare(
      `SELECT
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
    .get("workspace-a", "2026-09", "openai", "gpt-5") as {
    request_count: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_micros: number;
  };

  assert.deepEqual(providerUsage, {
    request_count: 2,
    input_tokens: 3000,
    output_tokens: 1500,
    estimated_cost_micros: 150_000,
  });
});

test("migration 175 rejects invalid usage and unknown workspaces", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  assert.throws(() => {
    db.prepare(
      `INSERT INTO tokenu_workspace_request_usage (
           workspace_id,
           period,
           request_count
         )
         VALUES (?, ?, ?)`
    ).run("workspace-missing", "2026-09", 1);
  }, /tokenu_workspace_not_found/);

  assert.throws(() => {
    db.prepare(
      `INSERT INTO tokenu_workspace_usage_metering (
           workspace_id,
           period,
           metered_execution_count,
           input_tokens,
           output_tokens,
           estimated_cost_micros
         )
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run("workspace-a", "2026-10", 1, -1, 0, 0);
  });

  assert.throws(() => {
    db.prepare(
      `INSERT INTO tokenu_workspace_request_usage (
           workspace_id,
           period,
           request_count
         )
         VALUES (?, ?, ?)`
    ).run("workspace-a", "2026-11", 1.5);
  });
});

test("migration 175 prevents deleting workspaces with persisted usage", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  db.prepare(
    `INSERT INTO tokenu_workspace_request_usage (
       workspace_id,
       period,
       request_count
     )
     VALUES (?, ?, ?)`
  ).run("workspace-a", "2026-09", 1);

  assert.throws(() => {
    db.prepare("DELETE FROM tokenu_workspaces WHERE id = ?").run("workspace-a");
  }, /tokenu_workspace_has_usage/);
});
