import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

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

  close(): void;
}

const require = createRequire(import.meta.url);

const BetterSqlite3 = require("better-sqlite3") as new (filename: string) => RawDatabase;

function createDatabase(): RawDatabase {
  const db = new BetterSqlite3(":memory:");

  db.exec(fs.readFileSync("src/lib/db/migrations/181_tokenu_api_keys.sql", "utf8"));

  return db;
}

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const INSERT = `
  INSERT INTO tokenu_api_keys (
    id,
    name,
    key_prefix,
    key_hash,
    created_at,
    expires_at,
    revoked_at,
    last_used_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

test("migration 181 stores only TokenU API-key identity metadata and hash", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  db.prepare(INSERT).run(
    "key-a",
    "Production key",
    "tku_live_abcd",
    HASH_A,
    "2026-09-10T00:00:00.000Z",
    null,
    null,
    null
  );

  const row = db
    .prepare(
      `SELECT
         id,
         name,
         key_prefix,
         key_hash,
         created_at,
         expires_at,
         revoked_at,
         last_used_at
       FROM tokenu_api_keys
       WHERE id = ?`
    )
    .get("key-a");

  assert.deepEqual(row, {
    id: "key-a",
    name: "Production key",
    key_prefix: "tku_live_abcd",
    key_hash: HASH_A,
    created_at: "2026-09-10T00:00:00.000Z",
    expires_at: null,
    revoked_at: null,
    last_used_at: null,
  });

  const columns = db.prepare("PRAGMA table_info(tokenu_api_keys)").all() as Array<{ name: string }>;

  const columnNames = columns.map((column) => column.name);

  assert.equal(columnNames.includes("key"), false);
  assert.equal(columnNames.includes("raw_key"), false);
  assert.equal(columnNames.includes("plaintext_key"), false);
});

test("migration 181 enforces unique deterministic API-key hashes", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const insert = db.prepare(INSERT);

  insert.run("key-a", "A", "tku_live_aaaa", HASH_A, "2026-09-10T00:00:00.000Z", null, null, null);

  assert.throws(
    () =>
      insert.run(
        "key-b",
        "B",
        "tku_live_bbbb",
        HASH_A,
        "2026-09-10T00:01:00.000Z",
        null,
        null,
        null
      ),
    /UNIQUE constraint failed/
  );

  insert.run("key-b", "B", "tku_live_bbbb", HASH_B, "2026-09-10T00:01:00.000Z", null, null, null);
});

test("migration 181 rejects malformed identity hash and lifecycle data", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const insert = db.prepare(INSERT);

  assert.throws(
    () =>
      insert.run("", "A", "tku_live_aaaa", HASH_A, "2026-09-10T00:00:00.000Z", null, null, null),
    /CHECK constraint failed/
  );

  assert.throws(
    () =>
      insert.run(
        "key-a",
        "",
        "tku_live_aaaa",
        HASH_A,
        "2026-09-10T00:00:00.000Z",
        null,
        null,
        null
      ),
    /CHECK constraint failed/
  );

  assert.throws(
    () => insert.run("key-a", "A", "", HASH_A, "2026-09-10T00:00:00.000Z", null, null, null),
    /CHECK constraint failed/
  );

  for (const invalidHash of ["a".repeat(63), "A".repeat(64), `${"a".repeat(63)}z`]) {
    assert.throws(
      () =>
        insert.run(
          `bad-${invalidHash.length}-${invalidHash[0]}`,
          "A",
          "tku_live_bad",
          invalidHash,
          "2026-09-10T00:00:00.000Z",
          null,
          null,
          null
        ),
      /CHECK constraint failed/
    );
  }

  assert.throws(
    () => insert.run("bad-date", "A", "tku_live_date", HASH_B, "not-a-date", null, null, null),
    /CHECK constraint failed/
  );
});
