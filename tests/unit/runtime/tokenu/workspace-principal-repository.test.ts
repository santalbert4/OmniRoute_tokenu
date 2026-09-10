import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryWorkspacePrincipalRepository } from "@/tokenu/runtime/inMemoryWorkspacePrincipalRepository";

test("workspace principal repository resolves API keys to their TokenU workspace", async () => {
  const repository = new InMemoryWorkspacePrincipalRepository();

  await repository.save({
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "key-a",
    assignedAt: "2026-09-09T00:00:00.000Z",
  });

  await repository.save({
    workspaceId: "workspace-b",
    principalType: "api_key",
    principalId: "key-b",
    assignedAt: "2026-09-09T00:01:00.000Z",
  });

  const first = await repository.get("api_key", "key-a");

  const second = await repository.get("api_key", "key-b");

  assert.equal(first?.workspaceId, "workspace-a");

  assert.equal(second?.workspaceId, "workspace-b");
});

test("workspace principal repository returns null for an unassigned API key", async () => {
  const repository = new InMemoryWorkspacePrincipalRepository();

  const binding = await repository.get("api_key", "unknown-key");

  assert.equal(binding, null);
});

test("workspace principal repository rejects reassignment to another workspace", async () => {
  const repository = new InMemoryWorkspacePrincipalRepository();

  await repository.save({
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "key-a",
    assignedAt: "2026-09-09T00:00:00.000Z",
  });

  await assert.rejects(
    repository.save({
      workspaceId: "workspace-b",
      principalType: "api_key",
      principalId: "key-a",
      assignedAt: "2026-09-09T00:01:00.000Z",
    }),
    /already assigned/
  );

  const binding = await repository.get("api_key", "key-a");

  assert.equal(binding?.workspaceId, "workspace-a");
});

test("workspace principal repository enumerates only one workspace in deterministic order", async () => {
  const repository = new InMemoryWorkspacePrincipalRepository();

  await repository.save({
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "key-a-later",
    assignedAt: "2026-09-10T00:03:00.000Z",
  });

  await repository.save({
    workspaceId: "workspace-b",
    principalType: "api_key",
    principalId: "key-b",
    assignedAt: "2026-09-10T00:01:00.000Z",
  });

  await repository.save({
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "key-a-first",
    assignedAt: "2026-09-10T00:02:00.000Z",
  });

  assert.deepEqual(await repository.listByWorkspace("workspace-a"), [
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

  assert.deepEqual(await repository.listByWorkspace("workspace-b"), [
    {
      workspaceId: "workspace-b",
      principalType: "api_key",
      principalId: "key-b",
      assignedAt: "2026-09-10T00:01:00.000Z",
    },
  ]);

  assert.deepEqual(await repository.listByWorkspace("workspace-missing"), []);

  assert.deepEqual(await repository.listByWorkspace(" "), []);
});
