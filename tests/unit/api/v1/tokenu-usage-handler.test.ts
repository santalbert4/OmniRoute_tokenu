import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "@/app/api/v1/tokenu/usage/route";
import {
  handleTokenUUsageGet,
  type TokenUUsageQuery,
} from "@/app/api/v1/tokenu/usage/usageHandler";
import type { WorkspaceUsageOverview } from "@/tokenu/contracts/workspaceUsageOverview";

const overview: WorkspaceUsageOverview = {
  workspaceId: "workspace-a",
  period: "2026-09",
  plan: {
    id: "starter",
    tier: "starter",
    currency: "USD",
  },
  requests: {
    used: 2,
    limit: 100,
    remaining: 98,
  },
  metering: {
    meteredExecutionCount: 2,
    inputTokens: 3000,
    outputTokens: 1500,
    totalTokens: 4500,
  },
  spend: {
    total: 0.4,
    limit: 10,
    remaining: 9.6,
    utilizationPercent: 4,
    currency: "USD",
  },
  providers: [
    {
      providerId: "openai",
      modelId: "gpt-test",
      requestCount: 2,
      inputTokens: 3000,
      outputTokens: 1500,
    },
  ],
};

async function body(response: Response): Promise<unknown> {
  return response.json();
}

test("public TokenU usage route is fail closed before P4E", async () => {
  const response = await GET();

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("usage handler requires exactly one valid YYYY-MM period", async () => {
  const query: TokenUUsageQuery = {
    async getOverview() {
      throw new Error("query must not run");
    },
  };

  const urls = [
    "http://localhost/api/v1/tokenu/usage",
    "http://localhost/api/v1/tokenu/usage?period=",
    "http://localhost/api/v1/tokenu/usage?period=2026-9",
    "http://localhost/api/v1/tokenu/usage?period=2026-00",
    "http://localhost/api/v1/tokenu/usage?period=2026-13",
    "http://localhost/api/v1/tokenu/usage?period=2026-09&period=2026-10",
  ];

  for (const url of urls) {
    const response = await handleTokenUUsageGet(new Request(url), "workspace-a", query);

    assert.equal(response.status, 400);
    assert.deepEqual(await body(response), {
      error: {
        code: "invalid_period",
        message: "period must use YYYY-MM format",
      },
    });
  }
});

test("usage handler rejects public workspace selection", async () => {
  const query: TokenUUsageQuery = {
    async getOverview() {
      throw new Error("query must not run");
    },
  };

  const response = await handleTokenUUsageGet(
    new Request("http://localhost/api/v1/tokenu/usage?period=2026-09&workspaceId=workspace-b"),
    "workspace-a",
    query
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await body(response), {
    error: {
      code: "unsupported_query_parameter",
      message: "Unsupported query parameter: workspaceId",
    },
  });
});

test("usage handler reads only the internally resolved workspace", async () => {
  const calls: Array<readonly [string, string]> = [];

  const query: TokenUUsageQuery = {
    async getOverview(workspaceId, period) {
      calls.push([workspaceId, period]);
      return overview;
    },
  };

  const response = await handleTokenUUsageGet(
    new Request("http://localhost/api/v1/tokenu/usage?period=2026-09"),
    "workspace-a",
    query
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [["workspace-a", "2026-09"]]);
  assert.deepEqual(await body(response), overview);
});

test("usage handler returns 404 when usage is unavailable", async () => {
  const query: TokenUUsageQuery = {
    async getOverview() {
      return null;
    },
  };

  const response = await handleTokenUUsageGet(
    new Request("http://localhost/api/v1/tokenu/usage?period=2026-09"),
    "workspace-a",
    query
  );

  assert.equal(response.status, 404);
});

test("usage handler refuses missing internal workspace identity", async () => {
  const query: TokenUUsageQuery = {
    async getOverview() {
      return overview;
    },
  };

  await assert.rejects(
    handleTokenUUsageGet(
      new Request("http://localhost/api/v1/tokenu/usage?period=2026-09"),
      "",
      query
    ),
    /requires workspace identity/
  );
});
