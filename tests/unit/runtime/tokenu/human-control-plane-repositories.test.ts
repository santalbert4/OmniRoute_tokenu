import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryTokenUUserRepository } from "@/tokenu/runtime/inMemoryTokenUUserRepository";
import { InMemoryWorkspaceMembershipRepository } from "@/tokenu/runtime/inMemoryWorkspaceMembershipRepository";

test("in-memory TokenU user repository preserves immutable user identity", async () => {
  const repository = new InMemoryTokenUUserRepository();

  await repository.save({
    id: "user-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  await repository.save({
    id: "user-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  assert.deepEqual(await repository.get("user-a"), {
    id: "user-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  await assert.rejects(
    repository.save({
      id: "user-a",
      createdAt: "2026-09-10T00:01:00.000Z",
    }),
    /TokenU user identity is immutable/
  );

  assert.equal(await repository.get("missing"), null);
  assert.equal(await repository.get(" "), null);
});

test("in-memory membership repository requires owner as first membership", async () => {
  const repository = new InMemoryWorkspaceMembershipRepository();

  await assert.rejects(
    repository.create({
      workspaceId: "workspace-a",
      userId: "admin-a",
      role: "admin",
      createdAt: "2026-09-10T00:00:00.000Z",
    }),
    /TokenU workspace requires owner/
  );

  await repository.create({
    workspaceId: "workspace-a",
    userId: "owner-a",
    role: "owner",
    createdAt: "2026-09-10T00:01:00.000Z",
  });

  await repository.create({
    workspaceId: "workspace-a",
    userId: "admin-a",
    role: "admin",
    createdAt: "2026-09-10T00:02:00.000Z",
  });

  assert.deepEqual(await repository.get("workspace-a", "admin-a"), {
    workspaceId: "workspace-a",
    userId: "admin-a",
    role: "admin",
    createdAt: "2026-09-10T00:02:00.000Z",
  });
});

test("in-memory membership create is INSERT-only and never changes roles implicitly", async () => {
  const repository = new InMemoryWorkspaceMembershipRepository();

  await repository.create({
    workspaceId: "workspace-a",
    userId: "owner-a",
    role: "owner",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  await repository.create({
    workspaceId: "workspace-a",
    userId: "member-a",
    role: "member",
    createdAt: "2026-09-10T00:01:00.000Z",
  });

  await assert.rejects(
    repository.create({
      workspaceId: "workspace-a",
      userId: "member-a",
      role: "admin",
      createdAt: "2026-09-10T00:01:00.000Z",
    }),
    /TokenU workspace membership already exists/
  );

  assert.equal((await repository.get("workspace-a", "member-a"))?.role, "member");

  assert.equal(await repository.updateRole("workspace-a", "member-a", "admin"), true);

  assert.equal((await repository.get("workspace-a", "member-a"))?.role, "admin");

  assert.equal(await repository.updateRole("workspace-a", "missing", "admin"), false);
});

test("in-memory membership enumeration is isolated and deterministic", async () => {
  const repository = new InMemoryWorkspaceMembershipRepository();

  await repository.create({
    workspaceId: "workspace-b",
    userId: "user-a",
    role: "owner",
    createdAt: "2026-09-10T00:03:00.000Z",
  });

  await repository.create({
    workspaceId: "workspace-a",
    userId: "user-a",
    role: "owner",
    createdAt: "2026-09-10T00:02:00.000Z",
  });

  await repository.create({
    workspaceId: "workspace-a",
    userId: "user-z",
    role: "member",
    createdAt: "2026-09-10T00:04:00.000Z",
  });

  await repository.create({
    workspaceId: "workspace-a",
    userId: "user-b",
    role: "admin",
    createdAt: "2026-09-10T00:03:00.000Z",
  });

  assert.deepEqual(
    (await repository.listByUser("user-a")).map((membership) => membership.workspaceId),
    ["workspace-a", "workspace-b"]
  );

  assert.deepEqual(
    (await repository.listByWorkspace("workspace-a")).map((membership) => membership.userId),
    ["user-a", "user-b", "user-z"]
  );

  assert.deepEqual(await repository.listByWorkspace("workspace-missing"), []);
  assert.deepEqual(await repository.listByUser(" "), []);
});

test("in-memory membership repository protects final owner but permits changes when another owner remains", async () => {
  const repository = new InMemoryWorkspaceMembershipRepository();

  await repository.create({
    workspaceId: "workspace-a",
    userId: "owner-a",
    role: "owner",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  await assert.rejects(
    repository.updateRole("workspace-a", "owner-a", "admin"),
    /TokenU workspace requires owner/
  );

  await assert.rejects(
    repository.remove("workspace-a", "owner-a"),
    /TokenU workspace requires owner/
  );

  await repository.create({
    workspaceId: "workspace-a",
    userId: "owner-b",
    role: "owner",
    createdAt: "2026-09-10T00:01:00.000Z",
  });

  assert.equal(await repository.updateRole("workspace-a", "owner-a", "admin"), true);

  assert.equal(await repository.remove("workspace-a", "owner-a"), true);
  assert.equal(await repository.remove("workspace-a", "owner-a"), false);

  assert.deepEqual(await repository.listByWorkspace("workspace-a"), [
    {
      workspaceId: "workspace-a",
      userId: "owner-b",
      role: "owner",
      createdAt: "2026-09-10T00:01:00.000Z",
    },
  ]);
});
