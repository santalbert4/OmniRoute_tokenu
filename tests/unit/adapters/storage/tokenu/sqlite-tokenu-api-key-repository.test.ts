import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { SqliteTokenUApiKeyRepository } from "@/tokenu/adapters/storage/sqliteTokenUApiKeyRepository";
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

  close(): void;
}

const require = createRequire(import.meta.url);

const BetterSqlite3 = require("better-sqlite3") as new (filename: string) => RawDatabase;

function createDatabase(): RawDatabase {
  const db = new BetterSqlite3(":memory:");

  db.exec(fs.readFileSync("src/lib/db/migrations/181_tokenu_api_keys.sql", "utf8"));

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db as unknown as TokenUSqliteDatabase;
}

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

test("SQLite TokenU API-key repository stores hash identity without raw bearer material", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteTokenUApiKeyRepository(asTokenUDatabase(db));

  await repository.save({
    id: "key-a",
    name: "Production key",
    keyPrefix: "tku_live_abcd",
    keyHash: HASH_A,
    createdAt: "2026-09-10T02:00:00+02:00",
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
  });

  assert.deepEqual(await repository.getById("key-a"), {
    id: "key-a",
    name: "Production key",
    keyPrefix: "tku_live_abcd",
    keyHash: HASH_A,
    createdAt: "2026-09-10T00:00:00.000Z",
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
  });

  assert.deepEqual(await repository.getByHash(HASH_A), {
    id: "key-a",
    name: "Production key",
    keyPrefix: "tku_live_abcd",
    keyHash: HASH_A,
    createdAt: "2026-09-10T00:00:00.000Z",
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
  });

  const tableSql = db
    .prepare(
      `SELECT sql
       FROM sqlite_master
       WHERE type = 'table'
         AND name = 'tokenu_api_keys'`
    )
    .get() as { sql: string };

  assert.equal(/\bkey\s+TEXT\b/i.test(tableSql.sql), false);
  assert.equal(tableSql.sql.includes("raw_key"), false);
});

test("SQLite TokenU API-key repository preserves credential identity during lifecycle updates", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteTokenUApiKeyRepository(asTokenUDatabase(db));

  await repository.save({
    id: "key-a",
    name: "Initial",
    keyPrefix: "tku_live_abcd",
    keyHash: HASH_A,
    createdAt: "2026-09-10T00:00:00.000Z",
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
  });

  await repository.save({
    id: "key-a",
    name: "Renamed",
    keyPrefix: "tku_live_abcd",
    keyHash: HASH_A,
    createdAt: "2020-01-01T00:00:00.000Z",
    expiresAt: "2026-12-01T01:00:00+01:00",
    revokedAt: "2026-11-01T01:00:00+01:00",
    lastUsedAt: "2026-10-01T02:00:00+02:00",
  });

  assert.deepEqual(await repository.getById("key-a"), {
    id: "key-a",
    name: "Renamed",
    keyPrefix: "tku_live_abcd",
    keyHash: HASH_A,
    createdAt: "2026-09-10T00:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
    revokedAt: "2026-11-01T00:00:00.000Z",
    lastUsedAt: "2026-10-01T00:00:00.000Z",
  });

  await assert.rejects(
    repository.save({
      id: "key-a",
      name: "Retarget hash",
      keyPrefix: "tku_live_abcd",
      keyHash: HASH_B,
      createdAt: "2026-09-10T00:00:00.000Z",
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
    }),
    /credential identity is immutable/
  );

  await assert.rejects(
    repository.save({
      id: "key-a",
      name: "Retarget prefix",
      keyPrefix: "tku_live_other",
      keyHash: HASH_A,
      createdAt: "2026-09-10T00:00:00.000Z",
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
    }),
    /credential identity is immutable/
  );
});

test("SQLite TokenU API-key repository rejects hash collisions and invalid metadata", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteTokenUApiKeyRepository(asTokenUDatabase(db));

  await repository.save({
    id: "key-a",
    name: "A",
    keyPrefix: "tku_live_aaaa",
    keyHash: HASH_A,
    createdAt: "2026-09-10T00:00:00.000Z",
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
  });

  await assert.rejects(
    repository.save({
      id: "key-b",
      name: "B",
      keyPrefix: "tku_live_bbbb",
      keyHash: HASH_A,
      createdAt: "2026-09-10T00:00:00.000Z",
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
    }),
    /UNIQUE constraint failed/
  );

  await assert.rejects(
    repository.save({
      id: "key-c",
      name: "C",
      keyPrefix: "tku_live_cccc",
      keyHash: "not-a-sha256-hash",
      createdAt: "2026-09-10T00:00:00.000Z",
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
    }),
    /lowercase SHA-256 hash/
  );

  assert.equal(await repository.getById("missing"), null);
  assert.equal(await repository.getByHash(HASH_B), null);
});

test("SQLite TokenU API-key repository updates lastUsedAt atomically and monotonically", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteTokenUApiKeyRepository(asTokenUDatabase(db));

  await repository.save({
    id: "key-last-used",
    name: "Last used",
    keyPrefix: "tku_live_used",
    keyHash: HASH_A,
    createdAt: "2026-09-10T00:00:00.000Z",
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
  });

  await repository.touchLastUsedAt("key-last-used", "2026-09-10T12:00:00.000Z");

  assert.equal((await repository.getById("key-last-used"))?.lastUsedAt, "2026-09-10T12:00:00.000Z");

  await repository.touchLastUsedAt("key-last-used", "2026-09-10T11:00:00.000Z");

  assert.equal((await repository.getById("key-last-used"))?.lastUsedAt, "2026-09-10T12:00:00.000Z");

  await repository.touchLastUsedAt("key-last-used", "2026-09-10T15:00:00+02:00");

  assert.equal((await repository.getById("key-last-used"))?.lastUsedAt, "2026-09-10T13:00:00.000Z");

  await repository.touchLastUsedAt("missing", "2026-09-10T14:00:00.000Z");

  await assert.rejects(
    repository.touchLastUsedAt("key-last-used", "not-a-date"),
    /Invalid TokenU API key lastUsedAt/
  );

  const raw = db
    .prepare(
      `SELECT
         key_hash,
         revoked_at,
         expires_at,
         last_used_at
       FROM tokenu_api_keys
       WHERE id = ?`
    )
    .get("key-last-used") as {
    key_hash: string;
    revoked_at: string | null;
    expires_at: string | null;
    last_used_at: string | null;
  };

  assert.deepEqual(raw, {
    key_hash: HASH_A,
    revoked_at: null,
    expires_at: null,
    last_used_at: "2026-09-10T13:00:00.000Z",
  });
});
