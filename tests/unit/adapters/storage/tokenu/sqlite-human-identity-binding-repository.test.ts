import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { SqliteHumanIdentityBindingRepository } from "@/tokenu/adapters/storage/sqliteHumanIdentityBindingRepository";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";

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
  const database = new BetterSqlite3(":memory:");

  for (const migration of [
    "173_tokenu_workspace_identity.sql",
    "182_tokenu_human_control_plane_identity.sql",
    "183_tokenu_human_auth_identity_bindings.sql",
  ]) {
    database.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  return database;
}

function asTokenUDatabase(database: RawDatabase): TokenUSqliteDatabase {
  return database as unknown as TokenUSqliteDatabase;
}

function seedUser(database: RawDatabase, userId: string): void {
  database
    .prepare(
      `INSERT INTO tokenu_users (
         id,
         created_at
       )
       VALUES (?, ?)`
    )
    .run(userId, "2026-09-10T10:00:00.000Z");
}

function seedBinding(
  database: RawDatabase,
  authority: string,
  subject: string,
  userId: string
): void {
  database
    .prepare(
      `INSERT INTO tokenu_human_identity_bindings (
         authority,
         subject,
         user_id,
         created_at
       )
       VALUES (?, ?, ?, ?)`
    )
    .run(authority, subject, userId, "2026-09-10T11:00:00.000Z");
}

test("SQLite human identity repository resolves exact authority and subject", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());

  seedUser(database, "user-a");

  seedBinding(database, "oidc:https://identity.example", "subject-a", "user-a");

  const repository = new SqliteHumanIdentityBindingRepository(asTokenUDatabase(database));

  assert.deepEqual(await repository.get("oidc:https://identity.example", "subject-a"), {
    authority: "oidc:https://identity.example",
    subject: "subject-a",
    userId: "user-a",
    createdAt: "2026-09-10T11:00:00.000Z",
  });
});

test("SQLite human identity repository does not confuse identity namespaces", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());

  seedUser(database, "user-a");
  seedUser(database, "user-b");

  seedBinding(database, "authority-a", "same-subject", "user-a");

  seedBinding(database, "authority-b", "same-subject", "user-b");

  const repository = new SqliteHumanIdentityBindingRepository(asTokenUDatabase(database));

  assert.equal((await repository.get("authority-a", "same-subject"))?.userId, "user-a");

  assert.equal((await repository.get("authority-b", "same-subject"))?.userId, "user-b");

  assert.equal(await repository.get("authority-c", "same-subject"), null);
});

test("SQLite human identity repository returns null for unknown or blank identity", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());

  const repository = new SqliteHumanIdentityBindingRepository(asTokenUDatabase(database));

  assert.equal(await repository.get("authority-a", "missing-subject"), null);

  assert.equal(await repository.get(" ", "subject-a"), null);

  assert.equal(await repository.get("authority-a", " "), null);
});
