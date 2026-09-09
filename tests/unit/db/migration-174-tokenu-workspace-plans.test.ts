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

function createMigratedDatabase(): RawDatabase {
  const db = new BetterSqlite3(":memory:");

  db.exec(fs.readFileSync("src/lib/db/migrations/173_tokenu_workspace_identity.sql", "utf8"));

  db.exec(fs.readFileSync("src/lib/db/migrations/174_tokenu_workspace_plans.sql", "utf8"));

  return db;
}

test("migration 174 enforces TokenU plan and assignment invariants", (t) => {
  const db = createMigratedDatabase();

  t.after(() => db.close());

  db.prepare(
    `INSERT INTO tokenu_workspaces (
       id,
       created_at
     )
     VALUES (?, ?)`
  ).run("workspace-a", "2026-09-09T00:00:00.000Z");

  const insertPlan = db.prepare(
    `INSERT INTO tokenu_workspace_plans (
       id,
       tier,
       monthly_cost_limit_micros,
       monthly_request_limit,
       currency
     )
     VALUES (?, ?, ?, ?, ?)`
  );

  insertPlan.run("starter", "starter", 20_000_000, 5000, "USD");

  insertPlan.run("pro", "pro", 50_000_000, 10000, "USD");

  const insertAssignment = db.prepare(
    `INSERT INTO tokenu_workspace_plan_assignments (
       workspace_id,
       plan_id,
       assigned_at
     )
     VALUES (?, ?, ?)`
  );

  insertAssignment.run("workspace-a", "starter", "2026-09-09T00:01:00.000Z");

  db.prepare(
    `UPDATE tokenu_workspace_plan_assignments
     SET plan_id = ?,
         assigned_at = ?
     WHERE workspace_id = ?`
  ).run("pro", "2026-09-09T00:02:00.000Z", "workspace-a");

  const assignment = db
    .prepare(
      `SELECT plan_id, assigned_at
     FROM tokenu_workspace_plan_assignments
     WHERE workspace_id = ?`
    )
    .get("workspace-a") as {
    plan_id: string;
    assigned_at: string;
  };

  assert.equal(assignment.plan_id, "pro");

  assert.equal(assignment.assigned_at, "2026-09-09T00:02:00.000Z");

  assert.throws(() => {
    insertAssignment.run("workspace-missing", "pro", "2026-09-09T00:03:00.000Z");
  }, /tokenu_workspace_not_found/);

  assert.throws(() => {
    db.prepare(
      `UPDATE tokenu_workspace_plan_assignments
         SET plan_id = ?
         WHERE workspace_id = ?`
    ).run("missing-plan", "workspace-a");
  }, /tokenu_plan_not_found/);

  assert.throws(() => {
    insertPlan.run("invalid", "invalid-tier", 1_000_000, 100, "USD");
  });

  assert.throws(() => {
    insertPlan.run("negative-cost", "starter", -1, 100, "USD");
  });

  assert.throws(() => {
    insertPlan.run("negative-requests", "starter", 1_000_000, -1, "USD");
  });

  assert.throws(() => {
    db.prepare("DELETE FROM tokenu_workspace_plans WHERE id = ?").run("pro");
  }, /tokenu_plan_has_assignments/);

  assert.throws(() => {
    db.prepare("DELETE FROM tokenu_workspaces WHERE id = ?").run("workspace-a");
  }, /tokenu_workspace_has_plan_assignment/);
});
