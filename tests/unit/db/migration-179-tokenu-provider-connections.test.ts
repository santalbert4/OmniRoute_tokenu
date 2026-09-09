import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

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
  const db = new BetterSqlite3(":memory:");

  db.exec(fs.readFileSync("src/lib/db/migrations/179_tokenu_provider_connections.sql", "utf8"));

  return db;
}

const INSERT = `
  INSERT INTO tokenu_provider_connections (
    id,
    provider_id,
    credential_mode,
    credential_kind,
    encrypted_credential,
    enabled,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

test("migration 179 stores TokenU-managed encrypted provider connections", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  db.prepare(INSERT).run(
    "groq-managed",
    "groq",
    "TOKENU_MANAGED",
    "api-key",
    "tokenu:cred:v1:0011:2233:4455",
    1,
    "2026-09-09T00:00:00.000Z",
    "2026-09-09T00:00:00.000Z"
  );

  const row = db
    .prepare(
      `SELECT
         id,
         provider_id,
         credential_mode,
         credential_kind,
         encrypted_credential,
         enabled,
         typeof(enabled) AS enabled_type
       FROM tokenu_provider_connections
       WHERE id = ?`
    )
    .get("groq-managed");

  assert.deepEqual(row, {
    id: "groq-managed",
    provider_id: "groq",
    credential_mode: "TOKENU_MANAGED",
    credential_kind: "api-key",
    encrypted_credential: "tokenu:cred:v1:0011:2233:4455",
    enabled: 1,
    enabled_type: "integer",
  });
});

test("migration 179 rejects plaintext credentials and non-managed modes", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const insert = db.prepare(INSERT);

  assert.throws(
    () =>
      insert.run(
        "plaintext",
        "groq",
        "TOKENU_MANAGED",
        "api-key",
        "gsk_plaintext_secret",
        1,
        "2026-09-09T00:00:00.000Z",
        "2026-09-09T00:00:00.000Z"
      ),
    /CHECK constraint failed/
  );

  assert.throws(
    () =>
      insert.run(
        "customer-byok",
        "groq",
        "HOSTED_BYOK",
        "api-key",
        "tokenu:cred:v1:0011:2233:4455",
        1,
        "2026-09-09T00:00:00.000Z",
        "2026-09-09T00:00:00.000Z"
      ),
    /CHECK constraint failed/
  );
});

test("migration 179 rejects invalid credential kinds and enabled flags", (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const insert = db.prepare(INSERT);

  assert.throws(
    () =>
      insert.run(
        "bad-kind",
        "groq",
        "TOKENU_MANAGED",
        "cookie",
        "tokenu:cred:v1:0011:2233:4455",
        1,
        "2026-09-09T00:00:00.000Z",
        "2026-09-09T00:00:00.000Z"
      ),
    /CHECK constraint failed/
  );

  assert.throws(
    () =>
      insert.run(
        "bad-enabled",
        "groq",
        "TOKENU_MANAGED",
        "api-key",
        "tokenu:cred:v1:0011:2233:4455",
        2,
        "2026-09-09T00:00:00.000Z",
        "2026-09-09T00:00:00.000Z"
      ),
    /CHECK constraint failed/
  );
});
