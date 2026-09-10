import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { SqliteWorkspacePrincipalRepository } from "@/tokenu/adapters/storage/sqliteWorkspacePrincipalRepository";
import { SqliteWorkspaceRepository } from "@/tokenu/adapters/storage/sqliteWorkspaceRepository";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";

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

function createDatabase(): RawDatabase {
  const db = new BetterSqlite3(":memory:");

  const migration = fs.readFileSync(
    "src/lib/db/migrations/173_tokenu_workspace_identity.sql",
    "utf8"
  );

  db.exec(migration);

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db;
}

test("SQLite workspace repository persists TokenU workspace identity", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const repository = new SqliteWorkspaceRepository(asTokenUDatabase(db));

  await repository.save({
    id: "workspace-a",
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  const workspace = await repository.get("workspace-a");

  assert.deepEqual(workspace, {
    id: "workspace-a",
    createdAt: "2026-09-09T00:00:00.000Z",
  });
});

test("SQLite workspace save is idempotent for an existing workspace", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const repository = new SqliteWorkspaceRepository(asTokenUDatabase(db));

  await repository.save({
    id: "workspace-a",
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  await repository.save({
    id: "workspace-a",
    createdAt: "2099-01-01T00:00:00.000Z",
  });

  const workspace = await repository.get("workspace-a");

  assert.equal(workspace?.createdAt, "2026-09-09T00:00:00.000Z");
});

test("SQLite principal repository persists API key workspace binding", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const database = asTokenUDatabase(db);

  const workspaceRepository = new SqliteWorkspaceRepository(database);

  const principalRepository = new SqliteWorkspacePrincipalRepository(database);

  await workspaceRepository.save({
    id: "workspace-a",
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  await principalRepository.save({
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "key-a",
    assignedAt: "2026-09-09T00:01:00.000Z",
  });

  const binding = await principalRepository.get("api_key", "key-a");

  assert.deepEqual(binding, {
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "key-a",
    assignedAt: "2026-09-09T00:01:00.000Z",
  });
});

test("SQLite principal repository rejects reassignment to another workspace", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const database = asTokenUDatabase(db);

  const workspaceRepository = new SqliteWorkspaceRepository(database);

  const principalRepository = new SqliteWorkspacePrincipalRepository(database);

  await workspaceRepository.save({
    id: "workspace-a",
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  await workspaceRepository.save({
    id: "workspace-b",
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  await principalRepository.save({
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "key-a",
    assignedAt: "2026-09-09T00:01:00.000Z",
  });

  await assert.rejects(
    principalRepository.save({
      workspaceId: "workspace-b",
      principalType: "api_key",
      principalId: "key-a",
      assignedAt: "2026-09-09T00:02:00.000Z",
    }),
    /already assigned/
  );

  const binding = await principalRepository.get("api_key", "key-a");

  assert.equal(binding?.workspaceId, "workspace-a");
});

test("SQLite principal repository rejects a missing TokenU workspace", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const repository = new SqliteWorkspacePrincipalRepository(asTokenUDatabase(db));

  await assert.rejects(
    repository.save({
      workspaceId: "workspace-missing",
      principalType: "api_key",
      principalId: "key-orphan",
      assignedAt: "2026-09-09T00:00:00.000Z",
    }),
    /tokenu_workspace_not_found/
  );
});

test("SQLite principal repository enumerates only one workspace in deterministic order", async (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  const database = asTokenUDatabase(db);

  const workspaceRepository = new SqliteWorkspaceRepository(database);

  const principalRepository = new SqliteWorkspacePrincipalRepository(database);

  await workspaceRepository.save({
    id: "workspace-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  await workspaceRepository.save({
    id: "workspace-b",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  await principalRepository.save({
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "key-a-later",
    assignedAt: "2026-09-10T00:03:00.000Z",
  });

  await principalRepository.save({
    workspaceId: "workspace-b",
    principalType: "api_key",
    principalId: "key-b",
    assignedAt: "2026-09-10T00:01:00.000Z",
  });

  await principalRepository.save({
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "key-a-first",
    assignedAt: "2026-09-10T00:02:00.000Z",
  });

  assert.deepEqual(await principalRepository.listByWorkspace("workspace-a"), [
    {
      workspaceId: "workspace-a",
      principalType: "api_key",
      principalId: "key-a-first",
      assignedAt: "2026-09-10T00:02:00.000Z",
    },
    {
      workspaceId: "workspace-a",
      principalType: "api_key",
      principalId: "key-a-later",
      assignedAt: "2026-09-10T00:03:00.000Z",
    },
  ]);

  assert.deepEqual(await principalRepository.listByWorkspace("workspace-b"), [
    {
      workspaceId: "workspace-b",
      principalType: "api_key",
      principalId: "key-b",
      assignedAt: "2026-09-10T00:01:00.000Z",
    },
  ]);

  assert.deepEqual(await principalRepository.listByWorkspace("workspace-missing"), []);

  assert.deepEqual(await principalRepository.listByWorkspace(" "), []);
});
