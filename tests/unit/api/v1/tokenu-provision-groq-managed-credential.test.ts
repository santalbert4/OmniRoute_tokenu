import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { provisionGroqManagedCredential } from "@/app/api/v1/tokenu/provisionGroqManagedCredential";
import { AesGcmCredentialCipher } from "@/tokenu/adapters/security/aesGcmCredentialCipher";
import { SqliteProviderConnectionRepository } from "@/tokenu/adapters/storage/sqliteProviderConnectionRepository";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import { PersistentSecretResolver } from "@/tokenu/runtime/persistentSecretResolver";

interface RawStatement {
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

const masterKey = "tokenu-provisioning-test-master-key-0123456789abcdef";

function createDatabase(): RawDatabase {
  const db = new BetterSqlite3(":memory:");

  db.exec(fs.readFileSync("src/lib/db/migrations/179_tokenu_provider_connections.sql", "utf8"));

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db as unknown as TokenUSqliteDatabase;
}

test("Groq provisioning persists only encrypted provider credential material", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const plaintext = "gsk_provision_test_secret";

  const result = await provisionGroqManagedCredential({
    database: asTokenUDatabase(db),
    credentialMasterKey: masterKey,
    groqApiKey: plaintext,
    recordedAt: "2026-09-09T20:00:00.000Z",
  });

  assert.deepEqual(result, {
    connectionId: "groq-managed",
    providerId: "groq",
    credentialKind: "api-key",
    enabled: true,
    createdAt: "2026-09-09T20:00:00.000Z",
    updatedAt: "2026-09-09T20:00:00.000Z",
  });

  const repository = new SqliteProviderConnectionRepository(asTokenUDatabase(db));

  const stored = await repository.get("groq-managed");

  assert.ok(stored);

  assert.match(stored.encryptedCredential, /^tokenu:cred:v1:/);

  assert.equal(stored.encryptedCredential.includes(plaintext), false);

  const resolver = new PersistentSecretResolver(repository, new AesGcmCredentialCipher(masterKey));

  assert.deepEqual(await resolver.resolve("groq-managed"), {
    kind: "api-key",
    value: plaintext,
  });
});

test("Groq provisioning rotates encrypted credential while preserving connection creation identity", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const database = asTokenUDatabase(db);

  await provisionGroqManagedCredential({
    database,
    credentialMasterKey: masterKey,
    groqApiKey: "gsk_first_secret",
    recordedAt: "2026-09-09T20:00:00.000Z",
  });

  const repository = new SqliteProviderConnectionRepository(database);

  const first = await repository.get("groq-managed");

  assert.ok(first);

  await provisionGroqManagedCredential({
    database,
    credentialMasterKey: masterKey,
    groqApiKey: "gsk_second_secret",
    recordedAt: "2026-09-09T21:00:00.000Z",
  });

  const second = await repository.get("groq-managed");

  assert.ok(second);

  assert.equal(second.createdAt, first.createdAt);

  assert.equal(second.updatedAt, "2026-09-09T21:00:00.000Z");

  assert.notEqual(second.encryptedCredential, first.encryptedCredential);

  const resolver = new PersistentSecretResolver(repository, new AesGcmCredentialCipher(masterKey));

  assert.deepEqual(await resolver.resolve("groq-managed"), {
    kind: "api-key",
    value: "gsk_second_secret",
  });
});

test("Groq provisioning rejects blank provider credentials", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  await assert.rejects(
    provisionGroqManagedCredential({
      database: asTokenUDatabase(db),
      credentialMasterKey: masterKey,
      groqApiKey: " ",
    }),
    /requires a non-empty provider API key/
  );
});

test("Groq provisioning rejects weak master keys before persistence", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  await assert.rejects(
    provisionGroqManagedCredential({
      database: asTokenUDatabase(db),
      credentialMasterKey: "too-short",
      groqApiKey: "gsk_test_secret",
    }),
    /master key/
  );

  const row = db
    .prepare(
      `SELECT id
       FROM tokenu_provider_connections
       WHERE id = ?`
    )
    .get("groq-managed");

  assert.equal(row, undefined);
});
