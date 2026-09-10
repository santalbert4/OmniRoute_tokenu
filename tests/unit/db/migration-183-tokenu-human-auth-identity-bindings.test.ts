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
    "183_tokenu_human_auth_identity_bindings.sql",
  ]) {
    db.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  return db;
}

function seedUser(db: RawDatabase, userId: string): void {
  db.prepare(
    `INSERT INTO tokenu_users (
       id,
       created_at
     )
     VALUES (?, ?)`
  ).run(userId, "2026-09-10T10:00:00.000Z");
}

const INSERT_BINDING = `
  INSERT INTO tokenu_human_identity_bindings (
    authority,
    subject,
    user_id,
    created_at
  )
  VALUES (?, ?, ?, ?)
`;

test("migration 183 stores only immutable external human identity binding state", (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  seedUser(db, "user-a");

  db.prepare(INSERT_BINDING).run(
    "oidc:https://identity.example",
    "opaque-subject-a",
    "user-a",
    "2026-09-10T11:00:00.000Z"
  );

  assert.deepEqual(
    db
      .prepare(
        `SELECT
           authority,
           subject,
           user_id,
           created_at
         FROM tokenu_human_identity_bindings
         WHERE authority = ?
           AND subject = ?`
      )
      .get("oidc:https://identity.example", "opaque-subject-a"),
    {
      authority: "oidc:https://identity.example",
      subject: "opaque-subject-a",
      user_id: "user-a",
      created_at: "2026-09-10T11:00:00.000Z",
    }
  );

  const columns = (
    db.prepare("PRAGMA table_info(tokenu_human_identity_bindings)").all() as Array<{ name: string }>
  ).map((column) => column.name);

  assert.deepEqual(columns, ["authority", "subject", "user_id", "created_at"]);

  for (const forbidden of [
    "email",
    "password",
    "password_hash",
    "access_token",
    "refresh_token",
    "session",
    "session_id",
    "workspace_id",
    "role",
  ]) {
    assert.equal(columns.includes(forbidden), false);
  }
});

test("migration 183 requires an existing TokenU user", (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  assert.throws(
    () =>
      db
        .prepare(INSERT_BINDING)
        .run("authority-a", "subject-a", "missing-user", "2026-09-10T11:00:00.000Z"),
    /tokenu_user_not_found/
  );
});

test("migration 183 uses authority and subject as exact composite identity", (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  seedUser(db, "user-a");
  seedUser(db, "user-b");
  seedUser(db, "user-c");

  const insert = db.prepare(INSERT_BINDING);

  insert.run("authority-a", "subject-a", "user-a", "2026-09-10T11:00:00.000Z");

  assert.throws(
    () => insert.run("authority-a", "subject-a", "user-b", "2026-09-10T11:01:00.000Z"),
    /UNIQUE constraint failed/
  );

  insert.run("authority-b", "subject-a", "user-b", "2026-09-10T11:02:00.000Z");

  insert.run("authority-a", "subject-b", "user-c", "2026-09-10T11:03:00.000Z");

  assert.deepEqual(
    db
      .prepare(
        `SELECT authority, subject, user_id
         FROM tokenu_human_identity_bindings
         ORDER BY authority ASC, subject ASC`
      )
      .all(),
    [
      {
        authority: "authority-a",
        subject: "subject-a",
        user_id: "user-a",
      },
      {
        authority: "authority-a",
        subject: "subject-b",
        user_id: "user-c",
      },
      {
        authority: "authority-b",
        subject: "subject-a",
        user_id: "user-b",
      },
    ]
  );
});

test("migration 183 rejects blank binding identity fields", (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  seedUser(db, "user-a");

  const insert = db.prepare(INSERT_BINDING);

  assert.throws(
    () => insert.run(" ", "subject-a", "user-a", "2026-09-10T11:00:00.000Z"),
    /CHECK constraint failed/
  );

  assert.throws(
    () => insert.run("authority-a", " ", "user-a", "2026-09-10T11:00:00.000Z"),
    /CHECK constraint failed/
  );

  assert.throws(
    () => insert.run("authority-a", "subject-a", " ", "2026-09-10T11:00:00.000Z"),
    /CHECK constraint failed/
  );

  assert.throws(
    () => insert.run("authority-a", "subject-a", "user-a", " "),
    /CHECK constraint failed/
  );
});

test("migration 183 prevents binding retargeting or identity mutation", (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  seedUser(db, "user-a");
  seedUser(db, "user-b");

  db.prepare(INSERT_BINDING).run("authority-a", "subject-a", "user-a", "2026-09-10T11:00:00.000Z");

  for (const sql of [
    `UPDATE tokenu_human_identity_bindings
     SET user_id = 'user-b'
     WHERE authority = 'authority-a'
       AND subject = 'subject-a'`,

    `UPDATE tokenu_human_identity_bindings
     SET subject = 'subject-b'
     WHERE authority = 'authority-a'
       AND subject = 'subject-a'`,

    `UPDATE tokenu_human_identity_bindings
     SET authority = 'authority-b'
     WHERE authority = 'authority-a'
       AND subject = 'subject-a'`,

    `UPDATE tokenu_human_identity_bindings
     SET created_at = '2026-09-10T12:00:00.000Z'
     WHERE authority = 'authority-a'
       AND subject = 'subject-a'`,
  ]) {
    assert.throws(() => db.exec(sql), /tokenu_human_identity_binding_immutable/);
  }

  assert.deepEqual(
    db
      .prepare(
        `SELECT
           authority,
           subject,
           user_id,
           created_at
         FROM tokenu_human_identity_bindings`
      )
      .get(),
    {
      authority: "authority-a",
      subject: "subject-a",
      user_id: "user-a",
      created_at: "2026-09-10T11:00:00.000Z",
    }
  );
});

test("migration 183 prevents deleting or retargeting a TokenU user behind a binding", (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  seedUser(db, "user-a");

  db.prepare(INSERT_BINDING).run("authority-a", "subject-a", "user-a", "2026-09-10T11:00:00.000Z");

  assert.throws(
    () =>
      db
        .prepare(
          `DELETE FROM tokenu_users
           WHERE id = ?`
        )
        .run("user-a"),
    /tokenu_user_has_human_identity_bindings/
  );

  assert.throws(
    () =>
      db
        .prepare(
          `UPDATE tokenu_users
           SET id = ?
           WHERE id = ?`
        )
        .run("user-retargeted", "user-a"),
    /tokenu_user_has_human_identity_bindings/
  );
});

test("migration 183 permits explicit binding removal before an otherwise unreferenced user is removed", (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  seedUser(db, "user-a");

  db.prepare(INSERT_BINDING).run("authority-a", "subject-a", "user-a", "2026-09-10T11:00:00.000Z");

  db.prepare(
    `DELETE FROM tokenu_human_identity_bindings
     WHERE authority = ?
       AND subject = ?`
  ).run("authority-a", "subject-a");

  db.prepare(
    `DELETE FROM tokenu_users
     WHERE id = ?`
  ).run("user-a");

  assert.equal(
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM tokenu_users
         WHERE id = ?`
      )
      .get("user-a") &&
      (
        db
          .prepare(
            `SELECT COUNT(*) AS count
             FROM tokenu_users
             WHERE id = ?`
          )
          .get("user-a") as { count: number }
      ).count,
    0
  );
});
