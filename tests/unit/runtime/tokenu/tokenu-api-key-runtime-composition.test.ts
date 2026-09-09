import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import { hashTokenUApiKey } from "@/tokenu/runtime/tokenUApiKeyMaterial";
import { createTokenURuntimeComposition } from "@/tokenu/runtime/tokenuRuntimeComposition";

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

  db.exec(fs.readFileSync("src/lib/db/migrations/181_tokenu_api_keys.sql", "utf8"));

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db as unknown as TokenUSqliteDatabase;
}

test("TokenU runtime composition exposes product-owned API-key repository and lifecycle service", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const runtime = createTokenURuntimeComposition(asTokenUDatabase(db));

  const created = await runtime.tokenUApiKeyService.create({
    name: "Runtime composition key",
    createdAt: "2026-09-10T00:00:00.000Z",
    expiresAt: "2026-10-10T00:00:00.000Z",
  });

  assert.match(created.token, /^tku_[A-Za-z0-9_-]{43}$/);

  assert.equal(
    await runtime.tokenUApiKeyService.resolvePrincipalId(created.token, "2026-09-10T12:00:00.000Z"),
    created.id
  );

  const stored = await runtime.tokenUApiKeyRepository.getById(created.id);

  assert.ok(stored);

  assert.equal(stored.keyHash, hashTokenUApiKey(created.token));

  assert.equal(stored.keyPrefix, created.keyPrefix);

  assert.equal(JSON.stringify(stored).includes(created.token), false);

  const raw = db
    .prepare(
      `SELECT
         id,
         key_prefix,
         key_hash
       FROM tokenu_api_keys
       WHERE id = ?`
    )
    .get(created.id) as {
    id: string;
    key_prefix: string;
    key_hash: string;
  };

  assert.deepEqual(raw, {
    id: created.id,
    key_prefix: created.keyPrefix,
    key_hash: hashTokenUApiKey(created.token),
  });
});
