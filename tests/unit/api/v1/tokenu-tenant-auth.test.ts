import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveTokenUTenantAuth,
  type TokenUTenantAuthDependencies,
} from "@/app/api/v1/tokenu/usage/tenantAuth";
import { InMemoryWorkspacePrincipalRepository } from "@/tokenu/runtime/inMemoryWorkspacePrincipalRepository";

function request(authorization?: string, extraHeaders?: Record<string, string>): Request {
  const headers = new Headers(extraHeaders);

  if (authorization) {
    headers.set("Authorization", authorization);
  }

  return new Request("http://localhost/api/v1/tokenu/usage?period=2026-09", {
    headers,
  });
}

function dependencies(
  options: {
    valid?: boolean;
    principalId?: string | null;
    repository?: InMemoryWorkspacePrincipalRepository;
  } = {}
): TokenUTenantAuthDependencies {
  return {
    async validateApiKey() {
      return options.valid ?? true;
    },

    async getApiKeyPrincipalId() {
      return options.principalId === undefined ? "key-a" : options.principalId;
    },

    workspacePrincipalRepository: options.repository ?? new InMemoryWorkspacePrincipalRepository(),
  };
}

test("TokenU tenant auth rejects missing Bearer credentials", async () => {
  const result = await resolveTokenUTenantAuth(request(), dependencies());

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    code: "unauthorized",
    message: "Unauthorized",
  });
});

test("TokenU tenant auth is Bearer-only and rejects x-api-key", async () => {
  let validationCalls = 0;

  const deps = dependencies();

  const result = await resolveTokenUTenantAuth(
    request(undefined, {
      "x-api-key": "secret-a",
      "anthropic-version": "2023-06-01",
    }),
    {
      ...deps,

      async validateApiKey(apiKey) {
        validationCalls += 1;

        return deps.validateApiKey(apiKey);
      },
    }
  );

  assert.equal(validationCalls, 0);

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    code: "unauthorized",
    message: "Unauthorized",
  });
});

test("TokenU tenant auth rejects an invalid Bearer API key", async () => {
  let metadataCalls = 0;

  const result = await resolveTokenUTenantAuth(request("Bearer invalid-secret"), {
    ...dependencies({
      valid: false,
    }),

    async getApiKeyPrincipalId() {
      metadataCalls += 1;
      return "must-not-run";
    },
  });

  assert.equal(metadataCalls, 0);

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    code: "unauthorized",
    message: "Unauthorized",
  });
});

test("TokenU tenant auth rejects env-key as tenant identity", async () => {
  const result = await resolveTokenUTenantAuth(
    request("Bearer operator-secret"),
    dependencies({
      principalId: "env-key",
    })
  );

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    code: "unauthorized",
    message: "Unauthorized",
  });
});

test("TokenU tenant auth returns 403 for a valid key without workspace assignment", async () => {
  const result = await resolveTokenUTenantAuth(
    request("Bearer valid-secret-a"),
    dependencies({
      principalId: "key-a",
    })
  );

  assert.deepEqual(result, {
    ok: false,
    status: 403,
    code: "workspace_not_assigned",
    message: "API key is not assigned to a TokenU workspace",
  });
});

test("TokenU tenant auth resolves workspace only through principal binding", async () => {
  const repository = new InMemoryWorkspacePrincipalRepository();

  await repository.save({
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "key-a",
    assignedAt: "2026-09-09T00:00:00.000Z",
  });

  const result = await resolveTokenUTenantAuth(
    request("Bearer secret-material-that-is-not-a-workspace-id"),
    dependencies({
      principalId: "key-a",
      repository,
    })
  );

  assert.deepEqual(result, {
    ok: true,
    principalId: "key-a",
    workspaceId: "workspace-a",
  });
});

test("TokenU tenant auth isolates different principals to different workspaces", async () => {
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

  const a = await resolveTokenUTenantAuth(
    request("Bearer secret-a"),
    dependencies({
      principalId: "key-a",
      repository,
    })
  );

  const b = await resolveTokenUTenantAuth(
    request("Bearer secret-b"),
    dependencies({
      principalId: "key-b",
      repository,
    })
  );

  assert.deepEqual(a, {
    ok: true,
    principalId: "key-a",
    workspaceId: "workspace-a",
  });

  assert.deepEqual(b, {
    ok: true,
    principalId: "key-b",
    workspaceId: "workspace-b",
  });
});
