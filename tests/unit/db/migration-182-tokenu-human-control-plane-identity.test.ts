import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

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

  close(): void;
}

const require = createRequire(import.meta.url);

const BetterSqlite3 = require("better-sqlite3") as new (filename: string) => RawDatabase;

function createDatabase(): RawDatabase {
  const db = new BetterSqlite3(":memory:");

  for (const migration of [
    "173_tokenu_workspace_identity.sql",
    "182_tokenu_human_control_plane_identity.sql",
  ]) {
    db.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  return db;
}

function seedWorkspace(db: RawDatabase, workspaceId: string): void {
  db.prepare(
    `INSERT INTO tokenu_workspaces (
       id,
       created_at
     )
     VALUES (?, ?)`
  ).run(workspaceId, "2026-09-10T00:00:00.000Z");
}

function seedUser(db: RawDatabase, userId: string): void {
  db.prepare(
    `INSERT INTO tokenu_users (
       id,
       created_at
     )
     VALUES (?, ?)`
  ).run(userId, "2026-09-10T00:00:00.000Z");
}

const INSERT_MEMBERSHIP = `
  INSERT INTO tokenu_workspace_memberships (
    workspace_id,
    user_id,
    role,
    created_at
  )
  VALUES (?, ?, ?, ?)
`;

test("migration 182 stores TokenU human identity separately from data-plane principals and auth credentials", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  seedWorkspace(db, "workspace-a");
  seedUser(db, "user-a");

  db.prepare(INSERT_MEMBERSHIP).run("workspace-a", "user-a", "owner", "2026-09-10T00:01:00.000Z");

  assert.deepEqual(
    db
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
      created_at: "2026-09-10T00:01:00.000Z",
    }
  );

  const userColumns = (
    db.prepare("PRAGMA table_info(tokenu_users)").all() as Array<{ name: string }>
  ).map((column) => column.name);

  assert.deepEqual(userColumns, ["id", "created_at"]);

  for (const forbidden of [
    "email",
    "password",
    "password_hash",
    "provider",
    "provider_subject",
    "session",
    "session_id",
    "token",
  ]) {
    assert.equal(userColumns.includes(forbidden), false);
  }

  const dataPlaneRows = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tokenu_workspace_principals
       WHERE workspace_id = ?`
    )
    .get("workspace-a") as {
    count: number;
  };

  assert.equal(dataPlaneRows.count, 0);
});

test("migration 182 requires existing TokenU workspace and user identities", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  seedUser(db, "user-a");

  assert.throws(
    () =>
      db
        .prepare(INSERT_MEMBERSHIP)
        .run("missing-workspace", "user-a", "owner", "2026-09-10T00:01:00.000Z"),
    /tokenu_workspace_not_found/
  );

  seedWorkspace(db, "workspace-a");

  assert.throws(
    () =>
      db
        .prepare(INSERT_MEMBERSHIP)
        .run("workspace-a", "missing-user", "owner", "2026-09-10T00:01:00.000Z"),
    /tokenu_user_not_found/
  );
});

test("migration 182 requires the first human workspace membership to be an owner", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  seedWorkspace(db, "workspace-a");
  seedUser(db, "user-admin");
  seedUser(db, "user-member");

  assert.throws(
    () =>
      db
        .prepare(INSERT_MEMBERSHIP)
        .run("workspace-a", "user-admin", "admin", "2026-09-10T00:01:00.000Z"),
    /tokenu_workspace_requires_owner/
  );

  assert.throws(
    () =>
      db
        .prepare(INSERT_MEMBERSHIP)
        .run("workspace-a", "user-member", "member", "2026-09-10T00:02:00.000Z"),
    /tokenu_workspace_requires_owner/
  );
});

test("migration 182 supports owner admin member roles and multiple owners", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  seedWorkspace(db, "workspace-a");

  for (const userId of ["owner-a", "owner-b", "admin-a", "member-a"]) {
    seedUser(db, userId);
  }

  const insert = db.prepare(INSERT_MEMBERSHIP);

  insert.run("workspace-a", "owner-a", "owner", "2026-09-10T00:01:00.000Z");

  insert.run("workspace-a", "owner-b", "owner", "2026-09-10T00:02:00.000Z");

  insert.run("workspace-a", "admin-a", "admin", "2026-09-10T00:03:00.000Z");

  insert.run("workspace-a", "member-a", "member", "2026-09-10T00:04:00.000Z");

  assert.deepEqual(
    db
      .prepare(
        `SELECT user_id, role
         FROM tokenu_workspace_memberships
         WHERE workspace_id = ?
         ORDER BY user_id ASC`
      )
      .all("workspace-a"),
    [
      {
        user_id: "admin-a",
        role: "admin",
      },
      {
        user_id: "member-a",
        role: "member",
      },
      {
        user_id: "owner-a",
        role: "owner",
      },
      {
        user_id: "owner-b",
        role: "owner",
      },
    ]
  );

  seedUser(db, "invalid-role-user");

  assert.throws(
    () => insert.run("workspace-a", "invalid-role-user", "superadmin", "2026-09-10T00:05:00.000Z"),
    /CHECK constraint failed/
  );
});

test("migration 182 enforces unique immutable workspace membership identity", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  seedWorkspace(db, "workspace-a");
  seedWorkspace(db, "workspace-b");
  seedUser(db, "user-a");
  seedUser(db, "user-b");

  const insert = db.prepare(INSERT_MEMBERSHIP);

  insert.run("workspace-a", "user-a", "owner", "2026-09-10T00:01:00.000Z");

  assert.throws(
    () => insert.run("workspace-a", "user-a", "owner", "2026-09-10T00:02:00.000Z"),
    /UNIQUE constraint failed/
  );

  assert.throws(
    () =>
      db
        .prepare(
          `UPDATE tokenu_workspace_memberships
           SET workspace_id = ?
           WHERE workspace_id = ?
             AND user_id = ?`
        )
        .run("workspace-b", "workspace-a", "user-a"),
    /tokenu_workspace_membership_identity_immutable/
  );

  assert.throws(
    () =>
      db
        .prepare(
          `UPDATE tokenu_workspace_memberships
           SET user_id = ?
           WHERE workspace_id = ?
             AND user_id = ?`
        )
        .run("user-b", "workspace-a", "user-a"),
    /tokenu_workspace_membership_identity_immutable/
  );
});

test("migration 182 prevents deleting or demoting the final workspace owner", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  seedWorkspace(db, "workspace-a");
  seedUser(db, "owner-a");
  seedUser(db, "member-a");

  const insert = db.prepare(INSERT_MEMBERSHIP);

  insert.run("workspace-a", "owner-a", "owner", "2026-09-10T00:01:00.000Z");

  insert.run("workspace-a", "member-a", "member", "2026-09-10T00:02:00.000Z");

  assert.throws(
    () =>
      db
        .prepare(
          `DELETE FROM tokenu_workspace_memberships
           WHERE workspace_id = ?
             AND user_id = ?`
        )
        .run("workspace-a", "owner-a"),
    /tokenu_workspace_requires_owner/
  );

  assert.throws(
    () =>
      db
        .prepare(
          `UPDATE tokenu_workspace_memberships
           SET role = 'admin'
           WHERE workspace_id = ?
             AND user_id = ?`
        )
        .run("workspace-a", "owner-a"),
    /tokenu_workspace_requires_owner/
  );
});

test("migration 182 allows owner removal or demotion when another owner remains", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  seedWorkspace(db, "workspace-a");
  seedUser(db, "owner-a");
  seedUser(db, "owner-b");

  const insert = db.prepare(INSERT_MEMBERSHIP);

  insert.run("workspace-a", "owner-a", "owner", "2026-09-10T00:01:00.000Z");

  insert.run("workspace-a", "owner-b", "owner", "2026-09-10T00:02:00.000Z");

  db.prepare(
    `UPDATE tokenu_workspace_memberships
     SET role = 'admin'
     WHERE workspace_id = ?
       AND user_id = ?`
  ).run("workspace-a", "owner-a");

  assert.deepEqual(
    db
      .prepare(
        `SELECT user_id, role
         FROM tokenu_workspace_memberships
         WHERE workspace_id = ?
         ORDER BY user_id ASC`
      )
      .all("workspace-a"),
    [
      {
        user_id: "owner-a",
        role: "admin",
      },
      {
        user_id: "owner-b",
        role: "owner",
      },
    ]
  );

  db.prepare(
    `DELETE FROM tokenu_workspace_memberships
     WHERE workspace_id = ?
       AND user_id = ?`
  ).run("workspace-a", "owner-a");

  assert.deepEqual(
    db
      .prepare(
        `SELECT user_id, role
         FROM tokenu_workspace_memberships
         WHERE workspace_id = ?`
      )
      .all("workspace-a"),
    [
      {
        user_id: "owner-b",
        role: "owner",
      },
    ]
  );
});

test("migration 182 prevents workspace or user deletion from orphaning memberships", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  seedWorkspace(db, "workspace-a");
  seedUser(db, "owner-a");

  db.prepare(INSERT_MEMBERSHIP).run("workspace-a", "owner-a", "owner", "2026-09-10T00:01:00.000Z");

  assert.throws(
    () =>
      db
        .prepare(
          `DELETE FROM tokenu_workspaces
           WHERE id = ?`
        )
        .run("workspace-a"),
    /tokenu_workspace_has_memberships/
  );

  assert.throws(
    () =>
      db
        .prepare(
          `DELETE FROM tokenu_users
           WHERE id = ?`
        )
        .run("owner-a"),
    /tokenu_user_has_memberships/
  );
});
