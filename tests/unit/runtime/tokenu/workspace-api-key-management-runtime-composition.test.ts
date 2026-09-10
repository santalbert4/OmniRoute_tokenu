import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
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
  const database = new BetterSqlite3(":memory:");

  for (const migration of ["173_tokenu_workspace_identity.sql", "181_tokenu_api_keys.sql"]) {
    database.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  return database;
}

function asTokenUDatabase(database: RawDatabase): TokenUSqliteDatabase {
  return database as unknown as TokenUSqliteDatabase;
}

test("TokenU runtime composition manages workspace API keys through one persistent SQLite identity boundary", async (t) => {
  const database = createDatabase();

  t.after(() => database.close());

  const runtime = createTokenURuntimeComposition(asTokenUDatabase(database));

  await runtime.workspaceRepository.save({
    id: "workspace-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  await runtime.workspaceRepository.save({
    id: "workspace-b",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  const created = await runtime.workspaceApiKeyManagementService.create("workspace-a", {
    name: " Runtime production ",
  });

  assert.match(created.token, /^tku_[A-Za-z0-9_-]{43}$/);

  assert.equal(created.name, "Runtime production");

  assert.equal(created.keyPrefix, created.token.slice(0, 12));

  const persistentCredential = database
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
    .get(created.id) as {
    id: string;
    name: string;
    key_prefix: string;
    key_hash: string;
    created_at: string;
    expires_at: string | null;
    revoked_at: string | null;
    last_used_at: string | null;
  };

  assert.equal(persistentCredential.id, created.id);

  assert.equal(persistentCredential.name, "Runtime production");

  assert.equal(persistentCredential.key_prefix, created.keyPrefix);

  assert.match(persistentCredential.key_hash, /^[0-9a-f]{64}$/);

  assert.notEqual(persistentCredential.key_hash, created.token);

  assert.equal(JSON.stringify(persistentCredential).includes(created.token), false);

  const binding = await runtime.workspacePrincipalRepository.get("api_key", created.id);

  assert.deepEqual(binding, {
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: created.id,
    assignedAt: created.createdAt,
  });

  const workspaceAKeys = await runtime.workspaceApiKeyManagementService.list(
    "workspace-a",
    "2099-01-01T00:00:00.000Z"
  );

  assert.deepEqual(workspaceAKeys, [
    {
      id: created.id,
      name: "Runtime production",
      keyPrefix: created.keyPrefix,
      createdAt: created.createdAt,
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
      status: "active",
    },
  ]);

  const serializedList = JSON.stringify(workspaceAKeys);

  assert.equal(serializedList.includes("keyHash"), false);

  assert.equal(serializedList.includes(created.token), false);

  assert.deepEqual(
    await runtime.workspaceApiKeyManagementService.list("workspace-b", "2099-01-01T00:00:00.000Z"),
    []
  );

  assert.equal(
    await runtime.workspaceApiKeyManagementService.revoke(
      "workspace-b",
      created.id,
      "2099-01-02T00:00:00.000Z"
    ),
    false
  );

  assert.equal(
    (await runtime.tokenUApiKeyService.getMetadata(created.id, "2099-01-02T01:00:00.000Z"))?.status,
    "active"
  );

  assert.equal(
    await runtime.workspaceApiKeyManagementService.revoke(
      "workspace-a",
      created.id,
      "2099-01-02T02:00:00.000Z"
    ),
    true
  );

  assert.deepEqual(
    await runtime.workspaceApiKeyManagementService.list("workspace-a", "2099-01-02T03:00:00.000Z"),
    [
      {
        id: created.id,
        name: "Runtime production",
        keyPrefix: created.keyPrefix,
        createdAt: created.createdAt,
        expiresAt: null,
        revokedAt: "2099-01-02T02:00:00.000Z",
        lastUsedAt: null,
        status: "revoked",
      },
    ]
  );
});
