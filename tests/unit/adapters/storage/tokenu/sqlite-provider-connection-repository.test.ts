import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { SqliteProviderConnectionRepository } from "@/tokenu/adapters/storage/sqliteProviderConnectionRepository";
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
  const db = new BetterSqlite3(":memory:");

  db.exec(fs.readFileSync("src/lib/db/migrations/179_tokenu_provider_connections.sql", "utf8"));

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db as unknown as TokenUSqliteDatabase;
}

test("SQLite provider connection persists encrypted credential metadata", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteProviderConnectionRepository(asTokenUDatabase(db));

  await repository.save({
    id: "groq-managed",
    providerId: "groq",
    credentialMode: "TOKENU_MANAGED",
    credentialKind: "api-key",
    encryptedCredential: "tokenu:cred:v1:0011:2233:4455",
    enabled: true,
    createdAt: "2026-09-09T02:00:00+02:00",
    updatedAt: "2026-09-09T02:00:00+02:00",
  });

  assert.deepEqual(await repository.get("groq-managed"), {
    id: "groq-managed",
    providerId: "groq",
    credentialMode: "TOKENU_MANAGED",
    credentialKind: "api-key",
    encryptedCredential: "tokenu:cred:v1:0011:2233:4455",
    enabled: true,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
  });
});

test("SQLite provider connection rotates ciphertext without changing identity", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteProviderConnectionRepository(asTokenUDatabase(db));

  await repository.save({
    id: "groq-managed",
    providerId: "groq",
    credentialMode: "TOKENU_MANAGED",
    credentialKind: "api-key",
    encryptedCredential: "tokenu:cred:v1:aaaa:bbbb:cccc",
    enabled: true,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
  });

  await repository.save({
    id: "groq-managed",
    providerId: "groq",
    credentialMode: "TOKENU_MANAGED",
    credentialKind: "api-key",
    encryptedCredential: "tokenu:cred:v1:dddd:eeee:ffff",
    enabled: false,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
  });

  assert.deepEqual(await repository.get("groq-managed"), {
    id: "groq-managed",
    providerId: "groq",
    credentialMode: "TOKENU_MANAGED",
    credentialKind: "api-key",
    encryptedCredential: "tokenu:cred:v1:dddd:eeee:ffff",
    enabled: false,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
  });
});

test("SQLite provider connection rejects identity retargeting", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteProviderConnectionRepository(asTokenUDatabase(db));

  await repository.save({
    id: "managed-connection",
    providerId: "groq",
    credentialMode: "TOKENU_MANAGED",
    credentialKind: "api-key",
    encryptedCredential: "tokenu:cred:v1:aaaa:bbbb:cccc",
    enabled: true,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
  });

  await assert.rejects(
    repository.save({
      id: "managed-connection",
      providerId: "openai",
      credentialMode: "TOKENU_MANAGED",
      credentialKind: "api-key",
      encryptedCredential: "tokenu:cred:v1:dddd:eeee:ffff",
      enabled: true,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    }),
    /identity is immutable/
  );
});

test("SQLite provider connection rejects plaintext credentials at persistence boundary", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteProviderConnectionRepository(asTokenUDatabase(db));

  await assert.rejects(
    repository.save({
      id: "plaintext",
      providerId: "groq",
      credentialMode: "TOKENU_MANAGED",
      credentialKind: "api-key",
      encryptedCredential: "gsk_should_never_be_stored",
      enabled: true,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
    }),
    /CHECK constraint failed/
  );
});
