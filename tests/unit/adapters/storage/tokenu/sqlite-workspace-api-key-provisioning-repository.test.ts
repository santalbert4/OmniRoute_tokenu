import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { SqliteWorkspaceApiKeyProvisioningRepository } from "@/tokenu/adapters/storage/sqliteWorkspaceApiKeyProvisioningRepository";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type { TokenUApiKey } from "@/tokenu/contracts/tokenUApiKey";

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

  for (const migration of ["173_tokenu_workspace_identity.sql", "181_tokenu_api_keys.sql"]) {
    db.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  db.prepare(
    `INSERT INTO tokenu_workspaces (
       id,
       created_at
     )
     VALUES (?, ?)`
  ).run("workspace-a", "2026-09-10T00:00:00.000Z");

  db.prepare(
    `INSERT INTO tokenu_workspaces (
       id,
       created_at
     )
     VALUES (?, ?)`
  ).run("workspace-b", "2026-09-10T00:00:00.000Z");

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db as unknown as TokenUSqliteDatabase;
}

function apiKey(id: string, hashCharacter: string): TokenUApiKey {
  return {
    id,
    name: `Key ${id}`,
    keyPrefix: `tku_${id}`,
    keyHash: hashCharacter.repeat(64),
    createdAt: "2026-09-10T01:00:00.000Z",
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
  };
}

test("SQLite workspace API-key provisioning commits credential and principal binding atomically", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteWorkspaceApiKeyProvisioningRepository(asTokenUDatabase(db));

  await repository.provision({
    workspaceId: "workspace-a",
    apiKey: apiKey("key-a", "a"),
    assignedAt: "2026-09-10T01:01:00.000Z",
  });

  const credential = db
    .prepare(
      `SELECT
         id,
         name,
         key_prefix,
         key_hash
       FROM tokenu_api_keys
       WHERE id = ?`
    )
    .get("key-a");

  assert.deepEqual(credential, {
    id: "key-a",
    name: "Key key-a",
    key_prefix: "tku_key-a",
    key_hash: "a".repeat(64),
  });

  const binding = db
    .prepare(
      `SELECT
         workspace_id,
         principal_type,
         principal_id,
         assigned_at
       FROM tokenu_workspace_principals
       WHERE principal_type = 'api_key'
         AND principal_id = ?`
    )
    .get("key-a");

  assert.deepEqual(binding, {
    workspace_id: "workspace-a",
    principal_type: "api_key",
    principal_id: "key-a",
    assigned_at: "2026-09-10T01:01:00.000Z",
  });
});

test("SQLite workspace API-key provisioning rolls back credential when workspace binding fails", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteWorkspaceApiKeyProvisioningRepository(asTokenUDatabase(db));

  await assert.rejects(
    repository.provision({
      workspaceId: "workspace-missing",
      apiKey: apiKey("key-missing-workspace", "b"),
      assignedAt: "2026-09-10T01:01:00.000Z",
    }),
    /tokenu_workspace_not_found/
  );

  const credentialCount = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tokenu_api_keys
       WHERE id = ?`
    )
    .get("key-missing-workspace") as {
    count: number;
  };

  assert.equal(credentialCount.count, 0);

  const bindingCount = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tokenu_workspace_principals
       WHERE principal_type = 'api_key'
         AND principal_id = ?`
    )
    .get("key-missing-workspace") as {
    count: number;
  };

  assert.equal(bindingCount.count, 0);
});

test("SQLite workspace API-key provisioning rolls back credential on principal identity conflict", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  db.prepare(
    `INSERT INTO tokenu_workspace_principals (
       workspace_id,
       principal_type,
       principal_id,
       assigned_at
     )
     VALUES (?, 'api_key', ?, ?)`
  ).run("workspace-b", "key-conflict", "2026-09-10T00:30:00.000Z");

  const repository = new SqliteWorkspaceApiKeyProvisioningRepository(asTokenUDatabase(db));

  await assert.rejects(
    repository.provision({
      workspaceId: "workspace-a",
      apiKey: apiKey("key-conflict", "c"),
      assignedAt: "2026-09-10T01:01:00.000Z",
    }),
    /UNIQUE constraint failed/
  );

  const credentialCount = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tokenu_api_keys
       WHERE id = ?`
    )
    .get("key-conflict") as {
    count: number;
  };

  assert.equal(credentialCount.count, 0);

  const binding = db
    .prepare(
      `SELECT workspace_id
       FROM tokenu_workspace_principals
       WHERE principal_type = 'api_key'
         AND principal_id = ?`
    )
    .get("key-conflict") as {
    workspace_id: string;
  };

  assert.equal(binding.workspace_id, "workspace-b");
});

test("SQLite workspace API-key provisioning validates identity before transaction", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const repository = new SqliteWorkspaceApiKeyProvisioningRepository(asTokenUDatabase(db));

  await assert.rejects(
    repository.provision({
      workspaceId: " ",
      apiKey: apiKey("key-a", "d"),
      assignedAt: "2026-09-10T01:01:00.000Z",
    }),
    /requires workspace identity/
  );

  await assert.rejects(
    repository.provision({
      workspaceId: "workspace-a",
      apiKey: {
        ...apiKey("key-invalid", "e"),
        keyHash: "invalid",
      },
      assignedAt: "2026-09-10T01:01:00.000Z",
    }),
    /lowercase SHA-256 hash/
  );
});
