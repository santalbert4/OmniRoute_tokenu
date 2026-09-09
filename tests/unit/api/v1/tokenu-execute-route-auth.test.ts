import assert from "node:assert/strict";
import test from "node:test";

import {
  handleTokenUExecuteRoute,
  type TokenUExecuteRouteDependencies,
} from "@/app/api/v1/tokenu/execute/route";

function request(): Request {
  return new Request("http://localhost/api/v1/tokenu/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-oss-20b",
      messages: [],
    }),
  });
}

test("TokenU execute route rejects unauthenticated requests before execution", async () => {
  let executionCalls = 0;

  const dependencies: TokenUExecuteRouteDependencies = {
    async resolveTenantAuth() {
      return {
        ok: false,
        status: 401,
        code: "unauthorized",
        message: "Unauthorized",
      };
    },

    async handleResolvedExecution() {
      executionCalls += 1;
      throw new Error("execution must not run");
    },
  };

  const response = await handleTokenUExecuteRoute(request(), dependencies);

  assert.equal(response.status, 401);
  assert.equal(executionCalls, 0);
});

test("TokenU execute route rejects principals without workspace assignment", async () => {
  let executionCalls = 0;

  const dependencies: TokenUExecuteRouteDependencies = {
    async resolveTenantAuth() {
      return {
        ok: false,
        status: 403,
        code: "workspace_not_assigned",
        message: "API key is not assigned to a TokenU workspace",
      };
    },

    async handleResolvedExecution() {
      executionCalls += 1;
      throw new Error("execution must not run");
    },
  };

  const response = await handleTokenUExecuteRoute(request(), dependencies);

  assert.equal(response.status, 403);
  assert.equal(executionCalls, 0);
});

test("TokenU execute route delegates only authenticated workspace identity", async () => {
  const workspaces: string[] = [];

  const dependencies: TokenUExecuteRouteDependencies = {
    async resolveTenantAuth() {
      return {
        ok: true,
        principalId: "key-a",
        workspaceId: "workspace-a",
      };
    },

    async handleResolvedExecution(_request, workspaceId) {
      workspaces.push(workspaceId);

      return Response.json({
        ok: true,
      });
    },
  };

  const response = await handleTokenUExecuteRoute(request(), dependencies);

  assert.equal(response.status, 200);
  assert.deepEqual(workspaces, ["workspace-a"]);
});

test("TokenU execute route keeps different principals isolated", async () => {
  async function run(principalId: string, workspaceId: string) {
    const seen: string[] = [];

    const response = await handleTokenUExecuteRoute(request(), {
      async resolveTenantAuth() {
        return {
          ok: true,
          principalId,
          workspaceId,
        };
      },

      async handleResolvedExecution(_request, resolvedWorkspaceId) {
        seen.push(resolvedWorkspaceId);

        return Response.json({
          workspaceId: resolvedWorkspaceId,
        });
      },
    });

    return {
      status: response.status,
      body: await response.json(),
      seen,
    };
  }

  const a = await run("key-a", "workspace-a");

  const b = await run("key-b", "workspace-b");

  assert.deepEqual(a.seen, ["workspace-a"]);
  assert.deepEqual(b.seen, ["workspace-b"]);

  assert.deepEqual(a.body, {
    workspaceId: "workspace-a",
  });

  assert.deepEqual(b.body, {
    workspaceId: "workspace-b",
  });
});
