import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { SqliteTokenUUserRepository } from "@/tokenu/adapters/storage/sqliteTokenUUserRepository";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import { SqliteWorkspaceMembershipRepository } from "@/tokenu/adapters/storage/sqliteWorkspaceMembershipRepository";

interface RawStatement {
  all(...params: unknown[]): readonly unknown[];

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
  const database = new BetterSqlite3(":memory:");

  for (const migration of [
    "173_tokenu_workspace_identity.sql",
    "182_tokenu_human_control_plane_identity.sql",
  ]) {
    database.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  return database;
}

function asTokenUDatabase(database: RawDatabase): TokenUSqliteDatabase {
  return database as unknown as TokenUSqliteDatabase;
}

function seedWorkspace(database: RawDatabase, workspaceId: string): void {
  database
    .prepare(
      `INSERT INTO tokenu_workspaces (
         id,
         created_at
       )
       VALUES (?, ?)`
    )
    .run(workspaceId, "2026-09-10T00:00:00.000Z");
}

test("SQLite TokenU user repository persists immutable internal user identity", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());

  const repository = new SqliteTokenUUserRepository(asTokenUDatabase(database));

  await repository.save({
    id: "user-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  await repository.save({
    id: "user-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  assert.deepEqual(await repository.get("user-a"), {
    id: "user-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  await assert.rejects(
    repository.save({
      id: "user-a",
      createdAt: "2026-09-10T00:01:00.000Z",
    }),
    /TokenU user identity is immutable/
  );

  assert.equal(await repository.get("missing"), null);
});

test("SQLite membership repository persists and enumerates isolated workspace membership", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());

  const db = asTokenUDatabase(database);
  const users = new SqliteTokenUUserRepository(db);
  const memberships = new SqliteWorkspaceMembershipRepository(db);

  seedWorkspace(database, "workspace-a");
  seedWorkspace(database, "workspace-b");

  for (const user of [
    {
      id: "user-a",
      createdAt: "2026-09-10T00:00:00.000Z",
    },
    {
      id: "user-b",
      createdAt: "2026-09-10T00:01:00.000Z",
    },
    {
      id: "user-z",
      createdAt: "2026-09-10T00:02:00.000Z",
    },
  ]) {
    await users.save(user);
  }

  await memberships.create({
    workspaceId: "workspace-b",
    userId: "user-a",
    role: "owner",
    createdAt: "2026-09-10T00:05:00.000Z",
  });

  await memberships.create({
    workspaceId: "workspace-a",
    userId: "user-a",
    role: "owner",
    createdAt: "2026-09-10T00:03:00.000Z",
  });

  await memberships.create({
    workspaceId: "workspace-a",
    userId: "user-z",
    role: "member",
    createdAt: "2026-09-10T00:05:00.000Z",
  });

  await memberships.create({
    workspaceId: "workspace-a",
    userId: "user-b",
    role: "admin",
    createdAt: "2026-09-10T00:04:00.000Z",
  });

  assert.deepEqual(
    (await memberships.listByUser("user-a")).map((membership) => membership.workspaceId),
    ["workspace-a", "workspace-b"]
  );

  assert.deepEqual(
    (await memberships.listByWorkspace("workspace-a")).map((membership) => membership.userId),
    ["user-a", "user-b", "user-z"]
  );

  assert.deepEqual(await memberships.get("workspace-a", "user-b"), {
    workspaceId: "workspace-a",
    userId: "user-b",
    role: "admin",
    createdAt: "2026-09-10T00:04:00.000Z",
  });

  assert.equal(await memberships.get("workspace-b", "user-b"), null);
});

test("SQLite membership create is INSERT-only and duplicate creation cannot mutate role", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());

  const db = asTokenUDatabase(database);
  const users = new SqliteTokenUUserRepository(db);
  const memberships = new SqliteWorkspaceMembershipRepository(db);

  seedWorkspace(database, "workspace-a");

  await users.save({
    id: "owner-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  await users.save({
    id: "member-a",
    createdAt: "2026-09-10T00:01:00.000Z",
  });

  await memberships.create({
    workspaceId: "workspace-a",
    userId: "owner-a",
    role: "owner",
    createdAt: "2026-09-10T00:02:00.000Z",
  });

  await memberships.create({
    workspaceId: "workspace-a",
    userId: "member-a",
    role: "member",
    createdAt: "2026-09-10T00:03:00.000Z",
  });

  await assert.rejects(
    memberships.create({
      workspaceId: "workspace-a",
      userId: "member-a",
      role: "admin",
      createdAt: "2026-09-10T00:03:00.000Z",
    }),
    /UNIQUE constraint failed/
  );

  assert.equal((await memberships.get("workspace-a", "member-a"))?.role, "member");

  assert.equal(await memberships.updateRole("workspace-a", "member-a", "admin"), true);

  assert.equal((await memberships.get("workspace-a", "member-a"))?.role, "admin");

  assert.equal(await memberships.updateRole("workspace-a", "missing", "member"), false);
});

test("SQLite membership repository delegates workspace and user integrity to migration 182", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());

  const db = asTokenUDatabase(database);
  const users = new SqliteTokenUUserRepository(db);
  const memberships = new SqliteWorkspaceMembershipRepository(db);

  await users.save({
    id: "user-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  await assert.rejects(
    memberships.create({
      workspaceId: "missing-workspace",
      userId: "user-a",
      role: "owner",
      createdAt: "2026-09-10T00:01:00.000Z",
    }),
    /tokenu_workspace_not_found/
  );

  seedWorkspace(database, "workspace-a");

  await assert.rejects(
    memberships.create({
      workspaceId: "workspace-a",
      userId: "missing-user",
      role: "owner",
      createdAt: "2026-09-10T00:02:00.000Z",
    }),
    /tokenu_user_not_found/
  );
});

test("SQLite membership repository delegates initial and final owner protection to migration 182", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());

  const db = asTokenUDatabase(database);
  const users = new SqliteTokenUUserRepository(db);
  const memberships = new SqliteWorkspaceMembershipRepository(db);

  seedWorkspace(database, "workspace-a");

  for (const user of [
    {
      id: "owner-a",
      createdAt: "2026-09-10T00:00:00.000Z",
    },
    {
      id: "owner-b",
      createdAt: "2026-09-10T00:01:00.000Z",
    },
    {
      id: "admin-a",
      createdAt: "2026-09-10T00:02:00.000Z",
    },
  ]) {
    await users.save(user);
  }

  await assert.rejects(
    memberships.create({
      workspaceId: "workspace-a",
      userId: "admin-a",
      role: "admin",
      createdAt: "2026-09-10T00:03:00.000Z",
    }),
    /tokenu_workspace_requires_owner/
  );

  await memberships.create({
    workspaceId: "workspace-a",
    userId: "owner-a",
    role: "owner",
    createdAt: "2026-09-10T00:04:00.000Z",
  });

  await assert.rejects(
    memberships.updateRole("workspace-a", "owner-a", "admin"),
    /tokenu_workspace_requires_owner/
  );

  await assert.rejects(
    memberships.remove("workspace-a", "owner-a"),
    /tokenu_workspace_requires_owner/
  );

  await memberships.create({
    workspaceId: "workspace-a",
    userId: "owner-b",
    role: "owner",
    createdAt: "2026-09-10T00:05:00.000Z",
  });

  assert.equal(await memberships.updateRole("workspace-a", "owner-a", "admin"), true);

  assert.equal(await memberships.remove("workspace-a", "owner-a"), true);

  assert.equal(await memberships.remove("workspace-a", "owner-a"), false);

  assert.deepEqual(await memberships.listByWorkspace("workspace-a"), [
    {
      workspaceId: "workspace-a",
      userId: "owner-b",
      role: "owner",
      createdAt: "2026-09-10T00:05:00.000Z",
    },
  ]);
});
