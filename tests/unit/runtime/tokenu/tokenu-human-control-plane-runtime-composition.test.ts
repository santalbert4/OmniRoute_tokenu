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

  for (const migration of [
    "173_tokenu_workspace_identity.sql",
    "181_tokenu_api_keys.sql",
    "182_tokenu_human_control_plane_identity.sql",
  ]) {
    database.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  return database;
}

function asTokenUDatabase(database: RawDatabase): TokenUSqliteDatabase {
  return database as unknown as TokenUSqliteDatabase;
}

function count(
  database: RawDatabase,
  table: string,
  where = "1 = 1",
  ...params: unknown[]
): number {
  const row = database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM ${table}
       WHERE ${where}`
    )
    .get(...params) as {
    count: number;
  };

  return row.count;
}

test("TokenU runtime composition shares one SQLite boundary across human control plane and API-key data plane", async (t) => {
  const database = createDatabase();

  t.after(() => database.close());

  const runtime = createTokenURuntimeComposition(asTokenUDatabase(database));

  await runtime.workspaceOwnerOnboardingRepository.provision({
    workspace: {
      id: "workspace-a",
      createdAt: "2026-09-10T01:00:00.000Z",
    },
    owner: {
      id: "owner-a",
      createdAt: "2026-09-10T00:00:00.000Z",
    },
    membershipCreatedAt: "2026-09-10T01:01:00.000Z",
  });

  await runtime.workspaceOwnerOnboardingRepository.provision({
    workspace: {
      id: "workspace-b",
      createdAt: "2026-09-10T02:00:00.000Z",
    },
    owner: {
      id: "owner-b",
      createdAt: "2026-09-10T00:30:00.000Z",
    },
    membershipCreatedAt: "2026-09-10T02:01:00.000Z",
  });

  assert.deepEqual(await runtime.tokenUUserRepository.get("owner-a"), {
    id: "owner-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  assert.deepEqual(await runtime.workspaceRepository.get("workspace-a"), {
    id: "workspace-a",
    createdAt: "2026-09-10T01:00:00.000Z",
  });

  assert.deepEqual(await runtime.workspaceMembershipRepository.get("workspace-a", "owner-a"), {
    workspaceId: "workspace-a",
    userId: "owner-a",
    role: "owner",
    createdAt: "2026-09-10T01:01:00.000Z",
  });

  assert.equal(count(database, "tokenu_workspace_principals"), 0);

  const ownerContext = await runtime.workspaceControlPlaneContextService.authorize(
    "owner-a",
    "workspace-a",
    "manage_api_keys"
  );

  assert.deepEqual(ownerContext, {
    workspaceId: "workspace-a",
    userId: "owner-a",
    role: "owner",
  });

  if (!ownerContext) {
    assert.fail("Expected workspace-a owner to receive authorized control-plane context");
  }

  const createdKey = await runtime.workspaceApiKeyManagementService.create(
    ownerContext.workspaceId,
    {
      name: " Human control plane key ",
    }
  );

  assert.match(createdKey.token, /^tku_[A-Za-z0-9_-]{43}$/);

  assert.equal(createdKey.name, "Human control plane key");

  assert.deepEqual(
    await runtime.workspaceApiKeyManagementService.list(
      ownerContext.workspaceId,
      "2099-01-01T00:00:00.000Z"
    ),
    [
      {
        id: createdKey.id,
        name: "Human control plane key",
        keyPrefix: createdKey.keyPrefix,
        createdAt: createdKey.createdAt,
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null,
        status: "active",
      },
    ]
  );

  assert.deepEqual(
    await runtime.workspaceApiKeyManagementService.list("workspace-b", "2099-01-01T00:00:00.000Z"),
    []
  );

  const dataPlaneBindings = database
    .prepare(
      `SELECT
         workspace_id,
         principal_type,
         principal_id
       FROM tokenu_workspace_principals
       ORDER BY principal_type ASC, principal_id ASC`
    )
    .all();

  assert.deepEqual(dataPlaneBindings, [
    {
      workspace_id: "workspace-a",
      principal_type: "api_key",
      principal_id: createdKey.id,
    },
  ]);

  assert.equal(JSON.stringify(dataPlaneBindings).includes("owner-a"), false);

  assert.equal(JSON.stringify(dataPlaneBindings).includes("owner-b"), false);

  await runtime.tokenUUserRepository.save({
    id: "member-a",
    createdAt: "2026-09-10T03:00:00.000Z",
  });

  await runtime.workspaceMembershipRepository.create({
    workspaceId: "workspace-a",
    userId: "member-a",
    role: "member",
    createdAt: "2026-09-10T03:01:00.000Z",
  });

  assert.equal(
    await runtime.workspaceControlPlaneContextService.authorize(
      "member-a",
      "workspace-a",
      "manage_api_keys"
    ),
    null
  );

  assert.equal(
    await runtime.workspaceControlPlaneContextService.authorize(
      "owner-a",
      "workspace-b",
      "manage_api_keys"
    ),
    null
  );

  assert.deepEqual(
    await runtime.workspaceControlPlaneContextService.authorize(
      "owner-b",
      "workspace-b",
      "manage_api_keys"
    ),
    {
      workspaceId: "workspace-b",
      userId: "owner-b",
      role: "owner",
    }
  );

  assert.equal(count(database, "tokenu_users"), 3);

  assert.equal(count(database, "tokenu_workspace_memberships"), 3);

  assert.equal(count(database, "tokenu_workspace_principals", "principal_type = 'api_key'"), 1);
});
