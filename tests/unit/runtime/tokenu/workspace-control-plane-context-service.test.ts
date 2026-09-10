import assert from "node:assert/strict";
import test from "node:test";

import type {
  TokenUUser,
  TokenUWorkspaceMembership,
} from "@/tokenu/contracts/humanControlPlaneIdentity";
import type { TokenUWorkspace } from "@/tokenu/contracts/workspaceIdentity";
import { WorkspaceControlPlaneContextService } from "@/tokenu/runtime/workspaceControlPlaneContextService";

interface FixtureOptions {
  readonly users?: readonly TokenUUser[];
  readonly workspaces?: readonly TokenUWorkspace[];
  readonly memberships?: readonly TokenUWorkspaceMembership[];
  readonly membershipOverride?: TokenUWorkspaceMembership | null;
}

function createFixture(options: FixtureOptions = {}) {
  const users = new Map((options.users ?? []).map((user) => [user.id, user] as const));

  const workspaces = new Map(
    (options.workspaces ?? []).map((workspace) => [workspace.id, workspace] as const)
  );

  const memberships = new Map(
    (options.memberships ?? []).map(
      (membership) => [`${membership.workspaceId}:${membership.userId}`, membership] as const
    )
  );

  const calls = {
    userGet: [] as string[],
    workspaceGet: [] as string[],
    membershipGet: [] as Array<readonly [string, string]>,
  };

  const service = new WorkspaceControlPlaneContextService(
    {
      async get(userId) {
        calls.userGet.push(userId);

        return users.get(userId) ?? null;
      },
    },
    {
      async get(workspaceId) {
        calls.workspaceGet.push(workspaceId);

        return workspaces.get(workspaceId) ?? null;
      },
    },
    {
      async get(workspaceId, userId) {
        calls.membershipGet.push([workspaceId, userId]);

        if (options.membershipOverride !== undefined) {
          return options.membershipOverride;
        }

        return memberships.get(`${workspaceId}:${userId}`) ?? null;
      },
    }
  );

  return {
    service,
    calls,
  };
}

const USER_A: TokenUUser = {
  id: "user-a",
  createdAt: "2026-09-10T00:00:00.000Z",
};

const WORKSPACE_A: TokenUWorkspace = {
  id: "workspace-a",
  createdAt: "2026-09-10T00:00:00.000Z",
};

function membership(role: TokenUWorkspaceMembership["role"]): TokenUWorkspaceMembership {
  return {
    workspaceId: "workspace-a",
    userId: "user-a",
    role,
    createdAt: "2026-09-10T00:01:00.000Z",
  };
}

test("control-plane context authorizes an owner for API-key management", async () => {
  const { service } = createFixture({
    users: [USER_A],
    workspaces: [WORKSPACE_A],
    memberships: [membership("owner")],
  });

  assert.deepEqual(await service.authorize("user-a", "workspace-a", "manage_api_keys"), {
    workspaceId: "workspace-a",
    userId: "user-a",
    role: "owner",
  });
});

test("control-plane context authorizes an admin for API-key management", async () => {
  const { service } = createFixture({
    users: [USER_A],
    workspaces: [WORKSPACE_A],
    memberships: [membership("admin")],
  });

  assert.deepEqual(await service.authorize("user-a", "workspace-a", "manage_api_keys"), {
    workspaceId: "workspace-a",
    userId: "user-a",
    role: "admin",
  });
});

test("control-plane context denies a member for API-key management", async () => {
  const { service } = createFixture({
    users: [USER_A],
    workspaces: [WORKSPACE_A],
    memberships: [membership("member")],
  });

  assert.equal(await service.authorize("user-a", "workspace-a", "manage_api_keys"), null);
});

test("control-plane context returns null for a user without exact workspace membership", async () => {
  const { service, calls } = createFixture({
    users: [USER_A],
    workspaces: [WORKSPACE_A],
  });

  assert.equal(await service.authorize("user-a", "workspace-a", "manage_api_keys"), null);

  assert.deepEqual(calls.membershipGet, [["workspace-a", "user-a"]]);

  assert.deepEqual(calls.userGet, []);
  assert.deepEqual(calls.workspaceGet, []);
});

test("control-plane context requires a trusted nonblank authenticated internal user id", async () => {
  const { service, calls } = createFixture();

  await assert.rejects(
    service.authorize("   ", "workspace-a", "manage_api_keys"),
    /requires authenticated user identity/
  );

  assert.deepEqual(calls.membershipGet, []);
  assert.deepEqual(calls.userGet, []);
  assert.deepEqual(calls.workspaceGet, []);
});

test("control-plane context rejects a blank requested workspace without treating it as trusted", async () => {
  const { service, calls } = createFixture({
    users: [USER_A],
  });

  assert.equal(await service.authorize("user-a", "   ", "manage_api_keys"), null);

  assert.deepEqual(calls.membershipGet, []);
  assert.deepEqual(calls.userGet, []);
  assert.deepEqual(calls.workspaceGet, []);
});

test("control-plane context preserves exact identifiers instead of trimming and retargeting them", async () => {
  const { service, calls } = createFixture({
    users: [USER_A],
    workspaces: [WORKSPACE_A],
    memberships: [membership("owner")],
  });

  assert.equal(await service.authorize(" user-a ", "workspace-a", "manage_api_keys"), null);

  assert.equal(await service.authorize("user-a", " workspace-a ", "manage_api_keys"), null);

  assert.deepEqual(calls.membershipGet, [
    ["workspace-a", " user-a "],
    [" workspace-a ", "user-a"],
  ]);
});

test("control-plane context fails closed when membership references a missing TokenU user", async () => {
  const { service } = createFixture({
    workspaces: [WORKSPACE_A],
    memberships: [membership("owner")],
  });

  await assert.rejects(
    service.authorize("user-a", "workspace-a", "manage_api_keys"),
    /references missing user identity/
  );
});

test("control-plane context fails closed when membership references a missing TokenU workspace", async () => {
  const { service } = createFixture({
    users: [USER_A],
    memberships: [membership("owner")],
  });

  await assert.rejects(
    service.authorize("user-a", "workspace-a", "manage_api_keys"),
    /references missing workspace identity/
  );
});

test("control-plane context rejects a membership repository that retargets identity", async () => {
  const { service } = createFixture({
    users: [USER_A],
    workspaces: [WORKSPACE_A],
    membershipOverride: {
      workspaceId: "workspace-other",
      userId: "user-a",
      role: "owner",
      createdAt: "2026-09-10T00:01:00.000Z",
    },
  });

  await assert.rejects(
    service.authorize("user-a", "workspace-a", "manage_api_keys"),
    /membership lookup returned mismatched identity/
  );
});

test("control-plane context also rejects a membership repository that substitutes another user", async () => {
  const { service } = createFixture({
    users: [USER_A],
    workspaces: [WORKSPACE_A],
    membershipOverride: {
      workspaceId: "workspace-a",
      userId: "user-other",
      role: "owner",
      createdAt: "2026-09-10T00:01:00.000Z",
    },
  });

  await assert.rejects(
    service.authorize("user-a", "workspace-a", "manage_api_keys"),
    /membership lookup returned mismatched identity/
  );
});
