import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { SqliteWorkspacePlanAssignmentRepository } from "@/tokenu/adapters/storage/sqliteWorkspacePlanAssignmentRepository";
import { SqliteWorkspacePlanRepository } from "@/tokenu/adapters/storage/sqliteWorkspacePlanRepository";
import { SqliteWorkspaceRepository } from "@/tokenu/adapters/storage/sqliteWorkspaceRepository";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import { WorkspacePlanResolverService } from "@/tokenu/runtime/workspacePlanResolverService";

interface RawStatement {
  get(...params: unknown[]): unknown;

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

  db.exec(fs.readFileSync("src/lib/db/migrations/173_tokenu_workspace_identity.sql", "utf8"));

  db.exec(fs.readFileSync("src/lib/db/migrations/174_tokenu_workspace_plans.sql", "utf8"));

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db;
}

test("SQLite plan repository persists catalog plans using integer money micros", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteWorkspacePlanRepository(asTokenUDatabase(db));

  await repository.save({
    id: "pro",
    tier: "pro",
    monthlyCostLimit: 12.345678,
    monthlyRequestLimit: 10000,
    currency: "USD",
  });

  const stored = db
    .prepare(
      `SELECT monthly_cost_limit_micros
       FROM tokenu_workspace_plans
       WHERE id = ?`
    )
    .get("pro") as {
    monthly_cost_limit_micros: number;
  };

  assert.equal(stored.monthly_cost_limit_micros, 12_345_678);

  const plan = await repository.get("pro");

  assert.deepEqual(plan, {
    id: "pro",
    tier: "pro",
    monthlyCostLimit: 12.345678,
    monthlyRequestLimit: 10000,
    currency: "USD",
  });
});

test("SQLite plan repository updates an existing plan definition", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteWorkspacePlanRepository(asTokenUDatabase(db));

  await repository.save({
    id: "pro",
    tier: "pro",
    monthlyCostLimit: 50,
    monthlyRequestLimit: 10000,
    currency: "USD",
  });

  await repository.save({
    id: "pro",
    tier: "pro",
    monthlyCostLimit: 75,
    monthlyRequestLimit: 20000,
    currency: "EUR",
  });

  const plan = await repository.get("pro");

  assert.deepEqual(plan, {
    id: "pro",
    tier: "pro",
    monthlyCostLimit: 75,
    monthlyRequestLimit: 20000,
    currency: "EUR",
  });
});

test("SQLite plan assignment repository persists and replaces active plan", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const database = asTokenUDatabase(db);

  const workspaceRepository = new SqliteWorkspaceRepository(database);

  const planRepository = new SqliteWorkspacePlanRepository(database);

  const assignmentRepository = new SqliteWorkspacePlanAssignmentRepository(database);

  await workspaceRepository.save({
    id: "workspace-a",
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  await planRepository.save({
    id: "starter",
    tier: "starter",
    monthlyCostLimit: 20,
    monthlyRequestLimit: 5000,
    currency: "USD",
  });

  await planRepository.save({
    id: "pro",
    tier: "pro",
    monthlyCostLimit: 50,
    monthlyRequestLimit: 10000,
    currency: "USD",
  });

  await assignmentRepository.save({
    workspaceId: "workspace-a",
    planId: "starter",
    assignedAt: "2026-09-09T00:01:00.000Z",
  });

  await assignmentRepository.save({
    workspaceId: "workspace-a",
    planId: "pro",
    assignedAt: "2026-09-09T00:02:00.000Z",
  });

  const assignment = await assignmentRepository.get("workspace-a");

  assert.deepEqual(assignment, {
    workspaceId: "workspace-a",
    planId: "pro",
    assignedAt: "2026-09-09T00:02:00.000Z",
  });
});

test("SQLite plan assignment repository rejects missing workspace and missing plan", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const database = asTokenUDatabase(db);

  const workspaceRepository = new SqliteWorkspaceRepository(database);

  const planRepository = new SqliteWorkspacePlanRepository(database);

  const assignmentRepository = new SqliteWorkspacePlanAssignmentRepository(database);

  await workspaceRepository.save({
    id: "workspace-a",
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  await planRepository.save({
    id: "pro",
    tier: "pro",
    monthlyCostLimit: 50,
    monthlyRequestLimit: 10000,
    currency: "USD",
  });

  await assert.rejects(
    assignmentRepository.save({
      workspaceId: "workspace-missing",
      planId: "pro",
      assignedAt: "2026-09-09T00:01:00.000Z",
    }),
    /tokenu_workspace_not_found/
  );

  await assert.rejects(
    assignmentRepository.save({
      workspaceId: "workspace-a",
      planId: "missing-plan",
      assignedAt: "2026-09-09T00:02:00.000Z",
    }),
    /tokenu_plan_not_found/
  );
});

test("workspace plan resolver works with SQLite repositories", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const database = asTokenUDatabase(db);

  const workspaceRepository = new SqliteWorkspaceRepository(database);

  const planRepository = new SqliteWorkspacePlanRepository(database);

  const assignmentRepository = new SqliteWorkspacePlanAssignmentRepository(database);

  await workspaceRepository.save({
    id: "workspace-a",
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  await planRepository.save({
    id: "pro",
    tier: "pro",
    monthlyCostLimit: 50,
    monthlyRequestLimit: 10000,
    currency: "USD",
  });

  await assignmentRepository.save({
    workspaceId: "workspace-a",
    planId: "pro",
    assignedAt: "2026-09-09T00:01:00.000Z",
  });

  const resolver = new WorkspacePlanResolverService(assignmentRepository, planRepository);

  const plan = await resolver.resolve("workspace-a");

  assert.equal(plan?.id, "pro");

  assert.equal(plan?.monthlyCostLimit, 50);
});
