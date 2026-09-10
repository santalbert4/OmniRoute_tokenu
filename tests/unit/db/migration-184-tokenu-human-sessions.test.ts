import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import Database from "better-sqlite3";

const MIGRATION = fs.readFileSync("src/lib/db/migrations/184_tokenu_human_sessions.sql", "utf8");

const HASH = "a".repeat(64);

function createDatabase(): Database.Database {
  const db = new Database(":memory:");

  db.exec(`
    CREATE TABLE tokenu_users (
      id TEXT PRIMARY KEY
        CHECK (length(trim(id)) > 0),
      created_at TEXT NOT NULL
        CHECK (length(trim(created_at)) > 0)
    );
  `);

  db.exec(MIGRATION);

  return db;
}

function insertUser(db: Database.Database, id = "user-a"): void {
  db.prepare("INSERT INTO tokenu_users (id, created_at) VALUES (?, ?)").run(
    id,
    "2026-09-10T00:00:00.000Z"
  );
}

function insertSession(db: Database.Database): void {
  db.prepare(
    `INSERT INTO tokenu_human_sessions (
       id,
       user_id,
       secret_hash,
       created_at,
       expires_at,
       revoked_at
     )
     VALUES (?, ?, ?, ?, ?, NULL)`
  ).run("session-a", "user-a", HASH, "2026-09-10T12:00:00.000Z", "2026-09-11T12:00:00.000Z");
}

test("migration 184 stores only server-side human session authentication state", () => {
  const db = createDatabase();

  try {
    const columns = db.prepare("PRAGMA table_info(tokenu_human_sessions)").all() as Array<{
      name: string;
    }>;

    assert.deepEqual(
      columns.map((column) => column.name),
      ["id", "user_id", "secret_hash", "created_at", "expires_at", "revoked_at"]
    );

    for (const forbidden of [
      "workspace_id",
      "role",
      "authority",
      "subject",
      "email",
      "password",
      "access_token",
      "refresh_token",
    ]) {
      assert.equal(
        columns.some((column) => column.name === forbidden),
        false
      );
    }
  } finally {
    db.close();
  }
});

test("migration 184 requires an existing TokenU user", () => {
  const db = createDatabase();

  try {
    assert.throws(() => insertSession(db), /tokenu_user_not_found/);
  } finally {
    db.close();
  }
});

test("migration 184 rejects blank identity fields and malformed secret hashes", () => {
  const db = createDatabase();

  try {
    insertUser(db);

    const insert = db.prepare(
      `INSERT INTO tokenu_human_sessions (
         id,
         user_id,
         secret_hash,
         created_at,
         expires_at,
         revoked_at
       )
       VALUES (?, ?, ?, ?, ?, NULL)`
    );

    assert.throws(() =>
      insert.run("", "user-a", HASH, "2026-09-10T12:00:00.000Z", "2026-09-11T12:00:00.000Z")
    );

    assert.throws(() =>
      insert.run("session-a", "", HASH, "2026-09-10T12:00:00.000Z", "2026-09-11T12:00:00.000Z")
    );

    assert.throws(() =>
      insert.run(
        "session-a",
        "user-a",
        "raw-secret",
        "2026-09-10T12:00:00.000Z",
        "2026-09-11T12:00:00.000Z"
      )
    );
  } finally {
    db.close();
  }
});

test("migration 184 prevents session identity, principal, secret and lifetime retargeting", () => {
  const db = createDatabase();

  try {
    insertUser(db);
    insertSession(db);

    for (const sql of [
      "UPDATE tokenu_human_sessions SET id = 'session-b' WHERE id = 'session-a'",
      "UPDATE tokenu_human_sessions SET user_id = 'user-b' WHERE id = 'session-a'",
      `UPDATE tokenu_human_sessions SET secret_hash = '${"b".repeat(64)}' WHERE id = 'session-a'`,
      "UPDATE tokenu_human_sessions SET created_at = '2026-09-10T11:00:00.000Z' WHERE id = 'session-a'",
      "UPDATE tokenu_human_sessions SET expires_at = '2026-09-12T12:00:00.000Z' WHERE id = 'session-a'",
    ]) {
      assert.throws(() => db.exec(sql), /tokenu_human_session_immutable/);
    }
  } finally {
    db.close();
  }
});

test("migration 184 allows one revocation and prevents clearing or rewriting it", () => {
  const db = createDatabase();

  try {
    insertUser(db);
    insertSession(db);

    db.exec(
      `UPDATE tokenu_human_sessions
       SET revoked_at = '2026-09-10T13:00:00.000Z'
       WHERE id = 'session-a'`
    );

    assert.throws(
      () =>
        db.exec(
          `UPDATE tokenu_human_sessions
           SET revoked_at = NULL
           WHERE id = 'session-a'`
        ),
      /tokenu_human_session_revocation_immutable/
    );

    assert.throws(
      () =>
        db.exec(
          `UPDATE tokenu_human_sessions
           SET revoked_at = '2026-09-10T14:00:00.000Z'
           WHERE id = 'session-a'`
        ),
      /tokenu_human_session_revocation_immutable/
    );
  } finally {
    db.close();
  }
});

test("migration 184 prevents deleting or retargeting a TokenU user behind sessions", () => {
  const db = createDatabase();

  try {
    insertUser(db);
    insertSession(db);

    assert.throws(
      () => db.exec("DELETE FROM tokenu_users WHERE id = 'user-a'"),
      /tokenu_user_has_human_sessions/
    );

    assert.throws(
      () => db.exec("UPDATE tokenu_users SET id = 'user-b' WHERE id = 'user-a'"),
      /tokenu_user_has_human_sessions/
    );
  } finally {
    db.close();
  }
});

test("migration 184 permits explicit session removal before user removal", () => {
  const db = createDatabase();

  try {
    insertUser(db);
    insertSession(db);

    db.exec("DELETE FROM tokenu_human_sessions WHERE id = 'session-a'");
    db.exec("DELETE FROM tokenu_users WHERE id = 'user-a'");

    const user = db.prepare("SELECT id FROM tokenu_users WHERE id = 'user-a'").get();

    assert.equal(user, undefined);
  } finally {
    db.close();
  }
});
