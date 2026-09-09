import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

interface RawStatement {
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

  const sql = fs.readFileSync("src/lib/db/migrations/173_tokenu_workspace_identity.sql", "utf8");

  db.exec(sql);

  return db;
}

test("migration 173 enforces TokenU workspace identity invariants", (t) => {
  const db = createMigratedDatabase();

  t.after(() => db.close());

  db.prepare(
    `INSERT INTO tokenu_workspaces (
       id,
       created_at
     )
     VALUES (?, ?)`
  ).run("workspace-a", "2026-09-09T00:00:00.000Z");

  db.prepare(
    `INSERT INTO tokenu_workspaces (
       id,
       created_at
     )
     VALUES (?, ?)`
  ).run("workspace-b", "2026-09-09T00:00:00.000Z");

  const insertPrincipal = db.prepare(
    `INSERT INTO tokenu_workspace_principals (
       workspace_id,
       principal_type,
       principal_id,
       assigned_at
     )
     VALUES (?, ?, ?, ?)`
  );

  insertPrincipal.run("workspace-a", "api_key", "key-a", "2026-09-09T00:01:00.000Z");

  assert.throws(() => {
    insertPrincipal.run("workspace-b", "api_key", "key-a", "2026-09-09T00:02:00.000Z");
  });

  assert.throws(() => {
    insertPrincipal.run("workspace-missing", "api_key", "key-orphan", "2026-09-09T00:03:00.000Z");
  }, /tokenu_workspace_not_found/);

  assert.throws(() => {
    insertPrincipal.run("workspace-a", "dashboard", "dashboard-1", "2026-09-09T00:04:00.000Z");
  });

  assert.throws(() => {
    db.prepare("DELETE FROM tokenu_workspaces WHERE id = ?").run("workspace-a");
  }, /tokenu_workspace_has_principals/);
});
