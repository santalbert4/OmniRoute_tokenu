import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { SqliteWorkspaceOwnerOnboardingRepository } from "@/tokenu/adapters/storage/sqliteWorkspaceOwnerOnboardingRepository";
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

function input(workspaceId: string, userId: string, userCreatedAt = "2026-09-10T00:00:00.000Z") {
  return {
    workspace: {
      id: workspaceId,
      createdAt: "2026-09-10T01:00:00.000Z",
    },
    owner: {
      id: userId,
      createdAt: userCreatedAt,
    },
    membershipCreatedAt: "2026-09-10T01:01:00.000Z",
  };
}

function count(database: RawDatabase, table: string, where: string, ...params: unknown[]): number {
  const row = database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM ${table}
       WHERE ${where}`
    )
    .get(...params) as {
    count: number;
  };

  return row.count;
}

test("SQLite workspace-owner onboarding atomically creates a new workspace new user and initial owner", async (t) => {
  const database = createDatabase();

  t.after(() => database.close());

  const repository = new SqliteWorkspaceOwnerOnboardingRepository(asTokenUDatabase(database));

  await repository.provision(input("workspace-a", "user-a"));

  assert.deepEqual(
    database
      .prepare(
        `SELECT id, created_at
         FROM tokenu_workspaces
         WHERE id = ?`
      )
      .get("workspace-a"),
    {
      id: "workspace-a",
      created_at: "2026-09-10T01:00:00.000Z",
    }
  );

  assert.deepEqual(
    database
      .prepare(
        `SELECT id, created_at
         FROM tokenu_users
         WHERE id = ?`
      )
      .get("user-a"),
    {
      id: "user-a",
      created_at: "2026-09-10T00:00:00.000Z",
    }
  );

  assert.deepEqual(
    database
      .prepare(
        `SELECT
           workspace_id,
           user_id,
           role,
           created_at
         FROM tokenu_workspace_memberships
         WHERE workspace_id = ?
           AND user_id = ?`
      )
      .get("workspace-a", "user-a"),
    {
      workspace_id: "workspace-a",
      user_id: "user-a",
      role: "owner",
      created_at: "2026-09-10T01:01:00.000Z",
    }
  );

  assert.equal(
    count(database, "tokenu_workspace_principals", "workspace_id = ?", "workspace-a"),
    0
  );
});

test("SQLite workspace-owner onboarding reuses an existing exact TokenU user for another new workspace", async (t) => {
  const database = createDatabase();

  t.after(() => database.close());

  database
    .prepare(
      `INSERT INTO tokenu_users (
         id,
         created_at
       )
       VALUES (?, ?)`
    )
    .run("user-a", "2026-09-10T00:00:00.000Z");

  const repository = new SqliteWorkspaceOwnerOnboardingRepository(asTokenUDatabase(database));

  await repository.provision(input("workspace-a", "user-a"));

  await repository.provision(input("workspace-b", "user-a"));

  assert.equal(count(database, "tokenu_users", "id = ?", "user-a"), 1);

  assert.deepEqual(
    database
      .prepare(
        `SELECT workspace_id, user_id, role
         FROM tokenu_workspace_memberships
         WHERE user_id = ?
         ORDER BY workspace_id ASC`
      )
      .all("user-a"),
    [
      {
        workspace_id: "workspace-a",
        user_id: "user-a",
        role: "owner",
      },
      {
        workspace_id: "workspace-b",
        user_id: "user-a",
        role: "owner",
      },
    ]
  );
});

test("SQLite workspace-owner onboarding rejects conflicting immutable user identity and rolls back the new workspace", async (t) => {
  const database = createDatabase();

  t.after(() => database.close());

  database
    .prepare(
      `INSERT INTO tokenu_users (
         id,
         created_at
       )
       VALUES (?, ?)`
    )
    .run("user-a", "2026-09-09T00:00:00.000Z");

  const repository = new SqliteWorkspaceOwnerOnboardingRepository(asTokenUDatabase(database));

  await assert.rejects(
    repository.provision(input("workspace-conflicting-user", "user-a", "2026-09-10T00:00:00.000Z")),
    /TokenU user identity is immutable/
  );

  assert.equal(count(database, "tokenu_workspaces", "id = ?", "workspace-conflicting-user"), 0);

  assert.deepEqual(
    database
      .prepare(
        `SELECT id, created_at
         FROM tokenu_users
         WHERE id = ?`
      )
      .get("user-a"),
    {
      id: "user-a",
      created_at: "2026-09-09T00:00:00.000Z",
    }
  );

  assert.equal(
    count(
      database,
      "tokenu_workspace_memberships",
      "workspace_id = ?",
      "workspace-conflicting-user"
    ),
    0
  );
});

test("SQLite workspace-owner onboarding refuses to adopt an existing workspace", async (t) => {
  const database = createDatabase();

  t.after(() => database.close());

  database
    .prepare(
      `INSERT INTO tokenu_workspaces (
         id,
         created_at
       )
       VALUES (?, ?)`
    )
    .run("workspace-existing", "2026-09-09T00:00:00.000Z");

  const repository = new SqliteWorkspaceOwnerOnboardingRepository(asTokenUDatabase(database));

  await assert.rejects(
    repository.provision(input("workspace-existing", "user-new")),
    /UNIQUE constraint failed/
  );

  assert.equal(count(database, "tokenu_users", "id = ?", "user-new"), 0);

  assert.equal(
    count(database, "tokenu_workspace_memberships", "workspace_id = ?", "workspace-existing"),
    0
  );

  assert.deepEqual(
    database
      .prepare(
        `SELECT id, created_at
         FROM tokenu_workspaces
         WHERE id = ?`
      )
      .get("workspace-existing"),
    {
      id: "workspace-existing",
      created_at: "2026-09-09T00:00:00.000Z",
    }
  );
});

test("SQLite workspace-owner onboarding rolls back a newly created workspace and user when membership insertion fails", async (t) => {
  const database = createDatabase();

  t.after(() => database.close());

  database.exec(`
    CREATE TRIGGER force_new_owner_membership_failure
    BEFORE INSERT ON tokenu_workspace_memberships
    WHEN NEW.workspace_id = 'workspace-fail-new-user'
    BEGIN
      SELECT RAISE(ABORT, 'forced_membership_failure');
    END;
  `);

  const repository = new SqliteWorkspaceOwnerOnboardingRepository(asTokenUDatabase(database));

  await assert.rejects(
    repository.provision(input("workspace-fail-new-user", "user-new")),
    /forced_membership_failure/
  );

  assert.equal(count(database, "tokenu_workspaces", "id = ?", "workspace-fail-new-user"), 0);

  assert.equal(count(database, "tokenu_users", "id = ?", "user-new"), 0);

  assert.equal(
    count(database, "tokenu_workspace_memberships", "workspace_id = ?", "workspace-fail-new-user"),
    0
  );
});

test("SQLite workspace-owner onboarding preserves a pre-existing user when later membership insertion rolls back", async (t) => {
  const database = createDatabase();

  t.after(() => database.close());

  database
    .prepare(
      `INSERT INTO tokenu_users (
         id,
         created_at
       )
       VALUES (?, ?)`
    )
    .run("user-existing", "2026-09-10T00:00:00.000Z");

  database.exec(`
    CREATE TRIGGER force_existing_owner_membership_failure
    BEFORE INSERT ON tokenu_workspace_memberships
    WHEN NEW.workspace_id = 'workspace-fail-existing-user'
    BEGIN
      SELECT RAISE(ABORT, 'forced_membership_failure');
    END;
  `);

  const repository = new SqliteWorkspaceOwnerOnboardingRepository(asTokenUDatabase(database));

  await assert.rejects(
    repository.provision(input("workspace-fail-existing-user", "user-existing")),
    /forced_membership_failure/
  );

  assert.equal(count(database, "tokenu_workspaces", "id = ?", "workspace-fail-existing-user"), 0);

  assert.deepEqual(
    database
      .prepare(
        `SELECT id, created_at
         FROM tokenu_users
         WHERE id = ?`
      )
      .get("user-existing"),
    {
      id: "user-existing",
      created_at: "2026-09-10T00:00:00.000Z",
    }
  );

  assert.equal(
    count(
      database,
      "tokenu_workspace_memberships",
      "workspace_id = ?",
      "workspace-fail-existing-user"
    ),
    0
  );
});

test("SQLite workspace-owner onboarding validates required identities before opening the transaction", async (t) => {
  const database = createDatabase();

  t.after(() => database.close());

  const repository = new SqliteWorkspaceOwnerOnboardingRepository(asTokenUDatabase(database));

  await assert.rejects(
    repository.provision({
      ...input("workspace-a", "user-a"),
      workspace: {
        id: " ",
        createdAt: "2026-09-10T01:00:00.000Z",
      },
    }),
    /requires workspace identity/
  );

  await assert.rejects(
    repository.provision({
      ...input("workspace-a", "user-a"),
      owner: {
        id: " ",
        createdAt: "2026-09-10T00:00:00.000Z",
      },
    }),
    /requires owner identity/
  );

  await assert.rejects(
    repository.provision({
      ...input("workspace-a", "user-a"),
      membershipCreatedAt: " ",
    }),
    /requires membership creation timestamp/
  );

  assert.equal(count(database, "tokenu_workspaces", "1 = 1"), 0);

  assert.equal(count(database, "tokenu_users", "1 = 1"), 0);

  assert.equal(count(database, "tokenu_workspace_memberships", "1 = 1"), 0);
});
