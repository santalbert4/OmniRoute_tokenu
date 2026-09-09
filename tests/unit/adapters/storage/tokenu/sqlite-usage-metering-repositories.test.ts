import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { SqliteProviderUsageRepository } from "@/tokenu/adapters/storage/sqliteProviderUsageRepository";
import { SqliteWorkspaceRequestUsageRepository } from "@/tokenu/adapters/storage/sqliteWorkspaceRequestUsageRepository";
import { SqliteWorkspaceUsageMeteringRepository } from "@/tokenu/adapters/storage/sqliteWorkspaceUsageMeteringRepository";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import { ProviderUsageMeteringService } from "@/tokenu/runtime/providerUsageMeteringService";
import { WorkspaceUsageMeteringService } from "@/tokenu/runtime/workspaceUsageMeteringService";

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
    "174_tokenu_workspace_plans.sql",
    "175_tokenu_usage_metering.sql",
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
  return db as TokenUSqliteDatabase;
}

test("SQLite request usage repository increments and isolates counters", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const repository = new SqliteWorkspaceRequestUsageRepository(asTokenUDatabase(db));

  await repository.increment("workspace-a", "2026-09");

  await repository.increment("workspace-a", "2026-09");

  await repository.increment("workspace-a", "2026-10");

  await repository.increment("workspace-b", "2026-09");

  assert.equal((await repository.get("workspace-a", "2026-09"))?.requestCount, 2);

  assert.equal((await repository.get("workspace-a", "2026-10"))?.requestCount, 1);

  assert.equal((await repository.get("workspace-b", "2026-09"))?.requestCount, 1);
});

test("SQLite workspace metering accumulates atomically using integer micros", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const repository = new SqliteWorkspaceUsageMeteringRepository(asTokenUDatabase(db));

  const service = new WorkspaceUsageMeteringService(repository);

  await service.record("workspace-a", "2026-09", 1000, 500, 0.05);

  await service.record("workspace-a", "2026-09", 2000, 1000, 0.1);

  assert.deepEqual(await repository.get("workspace-a", "2026-09"), {
    workspaceId: "workspace-a",
    period: "2026-09",
    meteredExecutionCount: 2,
    inputTokens: 3000,
    outputTokens: 1500,
    estimatedCost: 0.15,
  });

  const row = db
    .prepare(
      `SELECT estimated_cost_micros
     FROM tokenu_workspace_usage_metering
     WHERE workspace_id = ?
       AND period = ?`
    )
    .get("workspace-a", "2026-09") as {
    estimated_cost_micros: number;
  };

  assert.equal(row.estimated_cost_micros, 150_000);
});

test("SQLite provider usage accumulates and isolates provider and model", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const repository = new SqliteProviderUsageRepository(asTokenUDatabase(db));

  const service = new ProviderUsageMeteringService(repository);

  await service.record("workspace-a", "2026-09", "openai", "gpt-5", 1000, 500, 0.05);

  await service.record("workspace-a", "2026-09", "openai", "gpt-5", 2000, 1000, 0.1);

  await service.record("workspace-a", "2026-09", "groq", "model-a", 500, 250, 0.025);

  assert.deepEqual(await repository.get("workspace-a", "2026-09", "openai", "gpt-5"), {
    workspaceId: "workspace-a",
    period: "2026-09",
    providerId: "openai",
    modelId: "gpt-5",
    requestCount: 2,
    inputTokens: 3000,
    outputTokens: 1500,
    estimatedCost: 0.15,
  });

  const usages = await repository.list("workspace-a", "2026-09");

  assert.equal(usages.length, 2);

  assert.deepEqual(
    usages.map((usage) => [usage.providerId, usage.modelId]),
    [
      ["groq", "model-a"],
      ["openai", "gpt-5"],
    ]
  );

  const row = db
    .prepare(
      `SELECT estimated_cost_micros
     FROM tokenu_provider_usage
     WHERE workspace_id = ?
       AND period = ?
       AND provider_id = ?
       AND model_id = ?`
    )
    .get("workspace-a", "2026-09", "openai", "gpt-5") as {
    estimated_cost_micros: number;
  };

  assert.equal(row.estimated_cost_micros, 150_000);
});

test("SQLite metering repositories reject unknown workspaces", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const requestRepository = new SqliteWorkspaceRequestUsageRepository(asTokenUDatabase(db));

  const workspaceRepository = new SqliteWorkspaceUsageMeteringRepository(asTokenUDatabase(db));

  const providerRepository = new SqliteProviderUsageRepository(asTokenUDatabase(db));

  await assert.rejects(
    requestRepository.increment("workspace-missing", "2026-09"),
    /tokenu_workspace_not_found/
  );

  await assert.rejects(
    workspaceRepository.increment("workspace-missing", "2026-09", {
      inputTokens: 1,
      outputTokens: 1,
      estimatedCost: 0.01,
    }),
    /tokenu_workspace_not_found/
  );

  await assert.rejects(
    providerRepository.increment("workspace-missing", "2026-09", "openai", "gpt-5", {
      inputTokens: 1,
      outputTokens: 1,
      estimatedCost: 0.01,
    }),
    /tokenu_workspace_not_found/
  );
});

test("SQLite request admission atomically stops at the monthly limit", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const repository = new SqliteWorkspaceRequestUsageRepository(asTokenUDatabase(db));

  const results = await Promise.all(
    Array.from({ length: 20 }, () => repository.tryConsume("workspace-a", "2026-09", 3))
  );

  assert.equal(results.filter((result) => result.admitted).length, 3);

  assert.equal(results.filter((result) => !result.admitted).length, 17);

  assert.equal((await repository.get("workspace-a", "2026-09"))?.requestCount, 3);
});

test("SQLite request admission supports zero limit without creating a counter", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const repository = new SqliteWorkspaceRequestUsageRepository(asTokenUDatabase(db));

  const result = await repository.tryConsume("workspace-a", "2026-09", 0);

  assert.deepEqual(result, {
    admitted: false,
    remainingRequests: 0,
    reason: "monthly request quota exceeded",
  });

  assert.equal(await repository.get("workspace-a", "2026-09"), null);
});

test("SQLite request admission isolates workspace and period counters", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const repository = new SqliteWorkspaceRequestUsageRepository(asTokenUDatabase(db));

  assert.equal((await repository.tryConsume("workspace-a", "2026-09", 1)).admitted, true);

  assert.equal((await repository.tryConsume("workspace-a", "2026-09", 1)).admitted, false);

  assert.equal((await repository.tryConsume("workspace-a", "2026-10", 1)).admitted, true);

  assert.equal((await repository.tryConsume("workspace-b", "2026-09", 1)).admitted, true);
});

test("SQLite request admission rejects unknown workspace when admission could be consumed", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const repository = new SqliteWorkspaceRequestUsageRepository(asTokenUDatabase(db));

  await assert.rejects(
    repository.tryConsume("workspace-missing", "2026-09", 1),
    /tokenu_workspace_not_found/
  );
});
