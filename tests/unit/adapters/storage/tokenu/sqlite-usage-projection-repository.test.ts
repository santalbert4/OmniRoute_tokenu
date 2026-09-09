import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { SqliteUsageProjectionRepository } from "@/tokenu/adapters/storage/sqliteUsageProjectionRepository";
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

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db as unknown as TokenUSqliteDatabase;
}

const attempt = {
  workspaceId: "workspace-a",
  requestId: "request-1",
  attemptId: "attempt-1",
  period: "2026-09",
  providerId: "groq",
  modelId: "llama-test",
  inputTokens: 1000,
  outputTokens: 500,
  estimatedCost: 0.0006,
  recordedAt: "2026-09-09T10:00:00.000Z",
} as const;

test("SQLite usage projection atomically records identity and both aggregates", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteUsageProjectionRepository(asTokenUDatabase(db));

  assert.equal(await repository.projectAttempt(attempt), true);

  const identity = db
    .prepare(
      `SELECT
         workspace_id,
         attempt_id,
         estimated_cost_micros,
         typeof(estimated_cost_micros) AS cost_type
       FROM tokenu_usage_projection_attempts
       WHERE workspace_id = ?
         AND attempt_id = ?`
    )
    .get("workspace-a", "attempt-1");

  assert.deepEqual(identity, {
    workspace_id: "workspace-a",
    attempt_id: "attempt-1",
    estimated_cost_micros: 600,
    cost_type: "integer",
  });

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
    .get("workspace-a", "2026-09");

  assert.deepEqual(workspaceUsage, {
    metered_execution_count: 1,
    input_tokens: 1000,
    output_tokens: 500,
    estimated_cost_micros: 600,
  });

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
    .get("workspace-a", "2026-09", "groq", "llama-test");

  assert.deepEqual(providerUsage, {
    request_count: 1,
    input_tokens: 1000,
    output_tokens: 500,
    estimated_cost_micros: 600,
  });
});

test("SQLite usage projection identical redelivery is an idempotent no-op", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteUsageProjectionRepository(asTokenUDatabase(db));

  assert.equal(await repository.projectAttempt(attempt), true);
  assert.equal(await repository.projectAttempt(attempt), false);

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
    .get("workspace-a", "2026-09");

  assert.deepEqual(workspaceUsage, {
    metered_execution_count: 1,
    input_tokens: 1000,
    output_tokens: 500,
    estimated_cost_micros: 600,
  });

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
    .get("workspace-a", "2026-09", "groq", "llama-test");

  assert.deepEqual(providerUsage, {
    request_count: 1,
    input_tokens: 1000,
    output_tokens: 500,
    estimated_cost_micros: 600,
  });
});

test("SQLite usage projection rejects conflicting reuse of attempt identity", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteUsageProjectionRepository(asTokenUDatabase(db));

  assert.equal(await repository.projectAttempt(attempt), true);

  await assert.rejects(
    repository.projectAttempt({
      ...attempt,
      providerId: "openai",
      modelId: "gpt-test",
      inputTokens: 2000,
    }),
    /attempt already exists with different immutable data/
  );

  const workspaceUsage = db
    .prepare(
      `SELECT
         metered_execution_count,
         input_tokens,
         output_tokens
       FROM tokenu_workspace_usage_metering
       WHERE workspace_id = ?
         AND period = ?`
    )
    .get("workspace-a", "2026-09");

  assert.deepEqual(workspaceUsage, {
    metered_execution_count: 1,
    input_tokens: 1000,
    output_tokens: 500,
  });
});

test("SQLite usage projection redelivery remains idempotent if derived pricing later changes", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteUsageProjectionRepository(asTokenUDatabase(db));

  assert.equal(await repository.projectAttempt(attempt), true);

  assert.equal(
    await repository.projectAttempt({
      ...attempt,
      estimatedCost: 0.0099,
    }),
    false
  );

  const identity = db
    .prepare(
      `SELECT estimated_cost_micros
       FROM tokenu_usage_projection_attempts
       WHERE workspace_id = ?
         AND attempt_id = ?`
    )
    .get("workspace-a", "attempt-1");

  assert.deepEqual(identity, {
    estimated_cost_micros: 600,
  });

  const workspaceUsage = db
    .prepare(
      `SELECT
         metered_execution_count,
         estimated_cost_micros
       FROM tokenu_workspace_usage_metering
       WHERE workspace_id = ?
         AND period = ?`
    )
    .get("workspace-a", "2026-09");

  assert.deepEqual(workspaceUsage, {
    metered_execution_count: 1,
    estimated_cost_micros: 600,
  });

  const providerUsage = db
    .prepare(
      `SELECT
         request_count,
         estimated_cost_micros
       FROM tokenu_provider_usage
       WHERE workspace_id = ?
         AND period = ?
         AND provider_id = ?
         AND model_id = ?`
    )
    .get("workspace-a", "2026-09", "groq", "llama-test");

  assert.deepEqual(providerUsage, {
    request_count: 1,
    estimated_cost_micros: 600,
  });
});

test("SQLite usage projection scopes attempt identity by workspace", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteUsageProjectionRepository(asTokenUDatabase(db));

  assert.equal(await repository.projectAttempt(attempt), true);

  assert.equal(
    await repository.projectAttempt({
      ...attempt,
      workspaceId: "workspace-b",
    }),
    true
  );

  const count = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tokenu_usage_projection_attempts
       WHERE attempt_id = ?`
    )
    .get("attempt-1") as {
    count: number;
  };

  assert.equal(count.count, 2);
});

test("SQLite usage projection rolls back identity and workspace aggregate when provider projection fails", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  db.exec(`
    CREATE TRIGGER force_provider_usage_failure
    BEFORE INSERT ON tokenu_provider_usage
    BEGIN
      SELECT RAISE(ABORT, 'forced_provider_usage_failure');
    END;
  `);

  const repository = new SqliteUsageProjectionRepository(asTokenUDatabase(db));

  await assert.rejects(repository.projectAttempt(attempt), /forced_provider_usage_failure/);

  const identityCount = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tokenu_usage_projection_attempts
       WHERE workspace_id = ?
         AND attempt_id = ?`
    )
    .get("workspace-a", "attempt-1") as {
    count: number;
  };

  assert.equal(identityCount.count, 0);

  const workspaceCount = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tokenu_workspace_usage_metering
       WHERE workspace_id = ?
         AND period = ?`
    )
    .get("workspace-a", "2026-09") as {
    count: number;
  };

  assert.equal(workspaceCount.count, 0);

  const providerCount = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tokenu_provider_usage
       WHERE workspace_id = ?
         AND period = ?`
    )
    .get("workspace-a", "2026-09") as {
    count: number;
  };

  assert.equal(providerCount.count, 0);
});

test("SQLite usage projection validates period and usage counters before writing", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteUsageProjectionRepository(asTokenUDatabase(db));

  await assert.rejects(
    repository.projectAttempt({
      ...attempt,
      period: "2026-13",
    }),
    /period must use YYYY-MM/
  );

  await assert.rejects(
    repository.projectAttempt({
      ...attempt,
      inputTokens: -1,
    }),
    /input token count must be a non-negative safe integer/
  );

  const count = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tokenu_usage_projection_attempts`
    )
    .get() as {
    count: number;
  };

  assert.equal(count.count, 0);
});
