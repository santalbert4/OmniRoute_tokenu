import assert from "node:assert/strict";
import test from "node:test";

import {
  handleTokenUUsageRoute,
  type TokenUUsageRouteDependencies,
} from "@/app/api/v1/tokenu/usage/route";

function request(query = "period=2026-09"): Request {
  return new Request(`http://localhost/api/v1/tokenu/usage?${query}`);
}

test("usage route returns 401 auth failure without running usage handler", async () => {
  let usageCalls = 0;

  const dependencies: TokenUUsageRouteDependencies = {
    async resolveTenantAuth() {
      return {
        ok: false,
        status: 401,
        code: "unauthorized",
        message: "Unauthorized",
      };
    },

    async handleResolvedUsage() {
      usageCalls += 1;
      throw new Error("usage handler must not run");
    },
  };

  const response = await handleTokenUUsageRoute(request(), dependencies);

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(usageCalls, 0);

  assert.deepEqual(await response.json(), {
    error: {
      code: "unauthorized",
      message: "Unauthorized",
    },
  });
});

test("usage route returns 403 for valid principal without workspace", async () => {
  let usageCalls = 0;

  const dependencies: TokenUUsageRouteDependencies = {
    async resolveTenantAuth() {
      return {
        ok: false,
        status: 403,
        code: "workspace_not_assigned",
        message: "API key is not assigned to a TokenU workspace",
      };
    },

    async handleResolvedUsage() {
      usageCalls += 1;
      throw new Error("usage handler must not run");
    },
  };

  const response = await handleTokenUUsageRoute(request(), dependencies);

  assert.equal(response.status, 403);
  assert.equal(usageCalls, 0);

  assert.deepEqual(await response.json(), {
    error: {
      code: "workspace_not_assigned",
      message: "API key is not assigned to a TokenU workspace",
    },
  });
});

test("usage route delegates only the workspace resolved by tenant auth", async () => {
  const calls: string[] = [];

  const dependencies: TokenUUsageRouteDependencies = {
    async resolveTenantAuth() {
      return {
        ok: true,
        principalId: "key-a",
        workspaceId: "workspace-a",
      };
    },

    async handleResolvedUsage(_request, workspaceId) {
      calls.push(workspaceId);

      return Response.json({
        workspaceId,
      });
    },
  };

  const response = await handleTokenUUsageRoute(request(), dependencies);

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["workspace-a"]);

  assert.deepEqual(await response.json(), {
    workspaceId: "workspace-a",
  });
});

test("usage route never replaces resolved workspace with public workspaceId", async () => {
  const calls: string[] = [];

  const dependencies: TokenUUsageRouteDependencies = {
    async resolveTenantAuth() {
      return {
        ok: true,
        principalId: "key-a",
        workspaceId: "workspace-a",
      };
    },

    async handleResolvedUsage(_request, workspaceId) {
      calls.push(workspaceId);

      return Response.json({
        workspaceId,
      });
    },
  };

  await handleTokenUUsageRoute(request("period=2026-09&workspaceId=workspace-b"), dependencies);

  assert.deepEqual(calls, ["workspace-a"]);
});

test("usage route keeps different authenticated principals isolated", async () => {
  async function run(principalId: string, workspaceId: string) {
    const calls: string[] = [];

    const dependencies: TokenUUsageRouteDependencies = {
      async resolveTenantAuth() {
        return {
          ok: true,
          principalId,
          workspaceId,
        };
      },

      async handleResolvedUsage(_request, resolvedWorkspaceId) {
        calls.push(resolvedWorkspaceId);

        return Response.json({
          workspaceId: resolvedWorkspaceId,
        });
      },
    };

    const response = await handleTokenUUsageRoute(request(), dependencies);

    return {
      calls,
      body: await response.json(),
    };
  }

  const a = await run("key-a", "workspace-a");

  const b = await run("key-b", "workspace-b");

  assert.deepEqual(a.calls, ["workspace-a"]);

  assert.deepEqual(b.calls, ["workspace-b"]);

  assert.deepEqual(a.body, {
    workspaceId: "workspace-a",
  });

  assert.deepEqual(b.body, {
    workspaceId: "workspace-b",
  });
});
