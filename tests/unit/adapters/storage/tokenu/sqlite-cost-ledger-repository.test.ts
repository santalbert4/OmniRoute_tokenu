import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { SqliteCostLedgerRepository } from "@/tokenu/adapters/storage/sqliteCostLedgerRepository";
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

  close(): void;
}

const require = createRequire(import.meta.url);

const BetterSqlite3 = require("better-sqlite3") as new (filename: string) => RawDatabase;

function createDatabase(): RawDatabase {
  const db = new BetterSqlite3(":memory:");

  for (const migration of ["173_tokenu_workspace_identity.sql", "176_tokenu_cost_ledger.sql"]) {
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
  return db as TokenUSqliteDatabase;
}

test("SQLite cost ledger persists integer micros and identical append is idempotent", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteCostLedgerRepository(asTokenUDatabase(db));

  const entry = {
    workspaceId: "workspace-a",
    requestId: "request-1",
    attemptId: "attempt-1",
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 0.0006,
    createdAt: "2026-09-09T10:00:00.000Z",
  };

  assert.equal(await repository.append(entry), true);

  assert.equal(await repository.append(entry), false);

  assert.deepEqual(await repository.list("workspace-a"), [entry]);

  assert.equal(await repository.totalCost("workspace-a"), 0.0006);

  const row = db
    .prepare(
      `SELECT
       cost_micros,
       typeof(cost_micros) AS cost_type
     FROM tokenu_cost_ledger
     WHERE workspace_id = ?
       AND attempt_id = ?`
    )
    .get("workspace-a", "attempt-1") as {
    cost_micros: number;
    cost_type: string;
  };

  assert.equal(row.cost_micros, 600);

  assert.equal(row.cost_type, "integer");
});

test("SQLite cost ledger rejects conflicting data for the same workspace attempt", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteCostLedgerRepository(asTokenUDatabase(db));

  await repository.append({
    workspaceId: "workspace-a",
    requestId: "request-1",
    attemptId: "attempt-1",
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 0.0006,
    createdAt: "2026-09-09T10:00:00.000Z",
  });

  await assert.rejects(
    repository.append({
      workspaceId: "workspace-a",
      requestId: "request-1",
      attemptId: "attempt-1",
      providerId: "groq",
      modelId: "llama-test",
      currency: "USD",
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      cost: 0.001,
      createdAt: "2026-09-09T10:00:00.000Z",
    }),
    /already exists with different data/
  );

  assert.equal(await repository.totalCost("workspace-a"), 0.0006);
});

test("SQLite cost ledger scopes attempt identity by workspace", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteCostLedgerRepository(asTokenUDatabase(db));

  await repository.append({
    workspaceId: "workspace-a",
    requestId: "request-a",
    attemptId: "attempt-shared",
    providerId: "groq",
    modelId: "model-a",
    currency: "USD",
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    cost: 0.0001,
    createdAt: "2026-09-09T10:00:00.000Z",
  });

  await repository.append({
    workspaceId: "workspace-b",
    requestId: "request-b",
    attemptId: "attempt-shared",
    providerId: "openai",
    modelId: "model-b",
    currency: "USD",
    inputTokens: 200,
    outputTokens: 100,
    totalTokens: 300,
    cost: 0.0002,
    createdAt: "2026-09-09T10:01:00.000Z",
  });

  assert.equal((await repository.list("workspace-a")).length, 1);

  assert.equal((await repository.list("workspace-b")).length, 1);
});

test("SQLite cost ledger rejects unknown workspace", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteCostLedgerRepository(asTokenUDatabase(db));

  await assert.rejects(
    repository.append({
      workspaceId: "workspace-missing",
      requestId: "request-1",
      attemptId: "attempt-1",
      providerId: "groq",
      modelId: "llama-test",
      currency: "USD",
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cost: 0.0001,
      createdAt: "2026-09-09T10:00:00.000Z",
    }),
    /tokenu_workspace_not_found/
  );
});

test("SQLite cost ledger period totals use integer micros and isolate periods", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteCostLedgerRepository(asTokenUDatabase(db));

  await repository.append({
    workspaceId: "workspace-a",
    requestId: "request-1",
    attemptId: "attempt-1",
    providerId: "openai",
    modelId: "model-a",
    currency: "USD",
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    cost: 0.1,
    createdAt: "2026-09-01T10:00:00.000Z",
  });

  await repository.append({
    workspaceId: "workspace-a",
    requestId: "request-2",
    attemptId: "attempt-2",
    providerId: "openai",
    modelId: "model-b",
    currency: "USD",
    inputTokens: 200,
    outputTokens: 100,
    totalTokens: 300,
    cost: 0.2,
    createdAt: "2026-09-02T10:00:00.000Z",
  });

  await repository.append({
    workspaceId: "workspace-a",
    requestId: "request-old",
    attemptId: "attempt-old",
    providerId: "openai",
    modelId: "model-old",
    currency: "USD",
    inputTokens: 300,
    outputTokens: 150,
    totalTokens: 450,
    cost: 99,
    createdAt: "2026-08-31T10:00:00.000Z",
  });

  assert.deepEqual(await repository.periodTotals("workspace-a", "2026-09"), [
    {
      currency: "USD",
      executionCount: 2,
      totalCost: 0.3,
    },
  ]);

  const raw = db
    .prepare(
      `SELECT
       SUM(cost_micros)
         AS total_cost_micros,
       typeof(SUM(cost_micros))
         AS total_type
     FROM tokenu_cost_ledger
     WHERE workspace_id = ?
       AND substr(
         created_at,
         1,
         7
       ) = ?`
    )
    .get("workspace-a", "2026-09") as {
    total_cost_micros: number;
    total_type: string;
  };

  assert.equal(raw.total_cost_micros, 300000);

  assert.equal(raw.total_type, "integer");
});
