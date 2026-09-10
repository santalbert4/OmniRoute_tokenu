import assert from "node:assert/strict";
import test from "node:test";

import type {
  AuthorizedWorkspaceContext,
  TokenUControlPlaneAction,
  TokenUUser,
  TokenUWorkspaceMembership,
  TokenUWorkspaceRole,
} from "@/tokenu/contracts/humanControlPlaneIdentity";
import {
  canWorkspaceRolePerformAction,
  requireWorkspaceControlPlaneAction,
} from "@/tokenu/runtime/workspaceControlPlaneAuthorization";

test("TokenU human identity remains independent from authentication-provider identity", () => {
  const user: TokenUUser = {
    id: "user-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  };

  const serialized = JSON.stringify(user);

  assert.deepEqual(user, {
    id: "user-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  for (const forbidden of ["email", "password", "provider", "subject", "session", "token"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("TokenU workspace membership keeps human tenancy separate from data-plane API-key principals", () => {
  const membership: TokenUWorkspaceMembership = {
    workspaceId: "workspace-a",
    userId: "user-a",
    role: "owner",
    createdAt: "2026-09-10T00:01:00.000Z",
  };

  assert.deepEqual(membership, {
    workspaceId: "workspace-a",
    userId: "user-a",
    role: "owner",
    createdAt: "2026-09-10T00:01:00.000Z",
  });

  assert.equal(Object.prototype.hasOwnProperty.call(membership, "principalType"), false);

  assert.equal(Object.prototype.hasOwnProperty.call(membership, "principalId"), false);
});

test("manage_api_keys is authorized for owner and admin but denied to member", () => {
  const action: TokenUControlPlaneAction = "manage_api_keys";

  const matrix: ReadonlyArray<readonly [TokenUWorkspaceRole, boolean]> = [
    ["owner", true],
    ["admin", true],
    ["member", false],
  ];

  for (const [role, expected] of matrix) {
    assert.equal(canWorkspaceRolePerformAction(role, action), expected);
  }
});

test("workspace action authorization returns trusted context only for an allowed role", () => {
  const owner: AuthorizedWorkspaceContext = {
    workspaceId: "workspace-a",
    userId: "user-owner",
    role: "owner",
  };

  const admin: AuthorizedWorkspaceContext = {
    workspaceId: "workspace-a",
    userId: "user-admin",
    role: "admin",
  };

  const member: AuthorizedWorkspaceContext = {
    workspaceId: "workspace-a",
    userId: "user-member",
    role: "member",
  };

  assert.equal(requireWorkspaceControlPlaneAction(owner, "manage_api_keys"), owner);

  assert.equal(requireWorkspaceControlPlaneAction(admin, "manage_api_keys"), admin);

  assert.throws(
    () => requireWorkspaceControlPlaneAction(member, "manage_api_keys"),
    /TokenU workspace action forbidden/
  );
});
