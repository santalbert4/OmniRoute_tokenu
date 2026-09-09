import assert from "node:assert/strict";
import test from "node:test";

import type { TenantExecutionOrchestrationResult } from "@/tokenu/contracts/tenantExecutionOrchestrationResult";
import type { TokenUExecuteHandlerDependencies } from "@/app/api/v1/tokenu/execute/executeHandler";
import { handleTokenUExecute } from "@/app/api/v1/tokenu/execute/executeHandler";
import { PublicExecutionResolver } from "@/tokenu/runtime/publicExecutionResolver";
import { StaticPublicExecutionRouteRegistry } from "@/tokenu/runtime/staticPublicExecutionRouteRegistry";

const routeRegistry = new StaticPublicExecutionRouteRegistry([
  {
    publicModelId: "gpt-oss-20b",
    offering: {
      id: "groq:openai/gpt-oss-20b",
      providerId: "groq",
      canonicalModelId: "gpt-oss-20b",
      upstreamModelId: "openai/gpt-oss-20b",
      technicalProfileId: "groq-gpt-oss-20b-profile",
      credentialModes: ["TOKENU_MANAGED"],
      commercialStatus: "production-approved",
      availability: "available",
      serviceRegions: [],
      pricing: null,
    },
    credentialMode: "TOKENU_MANAGED",
    connectionId: "groq-managed",
    adapterId: "groq-official-openai-v1",
    endpointProfileId: "groq-official-chat-completions",
    serviceRegion: null,
  },
]);

function request(
  body: unknown,
  url = "http://localhost/api/v1/tokenu/execute",
  contentType = "application/json"
): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
    },
    body: JSON.stringify(body),
  });
}

function successfulResult(output: unknown): TenantExecutionOrchestrationResult {
  return {
    status: "executed",
    plan: {
      id: "starter",
      tier: "starter",
      monthlyCostLimit: 10,
      monthlyRequestLimit: 100,
      currency: "USD",
    },
    admission: {
      admitted: true,
      requestCount: 1,
      remainingRequests: 99,
    },
    execution: {
      status: "completed",
      result: {
        requestId: "request-server",
        attemptId: "request-server-1",
        target: {
          providerId: "groq",
          modelOfferingId: "groq:openai/gpt-oss-20b",
          upstreamModelId: "openai/gpt-oss-20b",
          connectionId: "groq-managed",
          credentialMode: "TOKENU_MANAGED",
          technicalProfileId: "groq-gpt-oss-20b-profile",
          adapterId: "groq-official-openai-v1",
          endpointProfileId: "groq-official-chat-completions",
          serviceRegion: null,
        },
        output: output as never,
        usage: {
          inputTokens: 2,
          outputTokens: 3,
          totalTokens: 5,
          reasoningTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        timing: {
          startedAt: "2026-09-09T12:00:00.000Z",
          completedAt: "2026-09-09T12:00:01.000Z",
          durationMs: 1000,
          timeToFirstByteMs: 100,
        },
        status: "succeeded",
        error: null,
        retryability: "not-retryable",
        interruption: "none",
      },
    },
  };
}

function dependencies(
  options: {
    result?: TenantExecutionOrchestrationResult;
    onExecute?: (
      input: Parameters<
        TokenUExecuteHandlerDependencies["tenantExecutionOrchestrator"]["execute"]
      >[0]
    ) => void;
  } = {}
): TokenUExecuteHandlerDependencies {
  return {
    publicExecutionResolver: new PublicExecutionResolver(routeRegistry),

    tenantExecutionOrchestrator: {
      async execute(input) {
        options.onExecute?.(input);

        return (
          options.result ??
          successfulResult({
            id: "chatcmpl-test",
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "hello",
                },
              },
            ],
          })
        );
      },
    },

    generateRequestId() {
      return "request-server";
    },

    currentPeriod() {
      return "2026-09";
    },
  };
}

test("TokenU execute resolves public model before tenant orchestration", async () => {
  let executionCalls = 0;

  const response = await handleTokenUExecute(
    request({
      model: "unknown-model",
      messages: [
        {
          role: "user",
          content: "hello",
        },
      ],
    }),
    "workspace-a",
    dependencies({
      onExecute() {
        executionCalls += 1;
      },
    })
  );

  assert.equal(response.status, 404);
  assert.equal(executionCalls, 0);
  assert.equal(response.headers.get("X-Request-Id"), "request-server");

  assert.deepEqual(await response.json(), {
    error: {
      code: "model_not_available",
      message: "The requested TokenU model is not available",
    },
  });
});

test("TokenU execute rejects public technical routing overrides", async () => {
  const forbiddenFields = [
    "workspaceId",
    "providerId",
    "upstreamModelId",
    "connectionId",
    "credentialMode",
    "technicalProfileId",
    "adapterId",
    "endpointProfileId",
    "serviceRegion",
    "endpoint",
    "url",
    "apiKey",
    "monthlyRequestLimit",
    "requestId",
    "attempts",
  ];

  for (const field of forbiddenFields) {
    const response = await handleTokenUExecute(
      request({
        model: "gpt-oss-20b",
        messages: [],
        [field]: "attacker-controlled",
      }),
      "workspace-a",
      dependencies()
    );

    assert.equal(response.status, 400, `expected ${field} to be rejected`);

    const body = await response.json();

    assert.equal(body.error.code, "internal_field_not_allowed");
  }
});

test("TokenU execute supports non-streaming only", async () => {
  const response = await handleTokenUExecute(
    request({
      model: "gpt-oss-20b",
      messages: [],
      stream: true,
    }),
    "workspace-a",
    dependencies()
  );

  assert.equal(response.status, 400);

  assert.deepEqual(await response.json(), {
    error: {
      code: "streaming_not_supported",
      message: "TokenU P6G execution supports non-streaming requests only",
    },
  });
});

test("TokenU execute passes only trusted workspace and server period to orchestrator", async () => {
  const seen: {
    workspaceId?: string;
    period?: string;
    requestId?: string;
    connectionId?: string;
  } = {};

  const response = await handleTokenUExecute(
    request({
      model: "gpt-oss-20b",
      messages: [
        {
          role: "user",
          content: "hello",
        },
      ],
      temperature: 0.2,
    }),
    "workspace-authenticated",
    dependencies({
      onExecute(input) {
        seen.workspaceId = input.workspaceId;
        seen.period = input.period;
        seen.requestId = input.executionPlan.requestId;
        seen.connectionId = input.executionPlan.attempts[0]?.target.connectionId;
      },
    })
  );

  assert.equal(response.status, 200);

  assert.deepEqual(seen, {
    workspaceId: "workspace-authenticated",
    period: "2026-09",
    requestId: "request-server",
    connectionId: "groq-managed",
  });

  assert.equal(response.headers.get("X-Request-Id"), "request-server");
});

test("TokenU execute maps plan and quota failures before technical response", async () => {
  const noPlan = await handleTokenUExecute(
    request({
      model: "gpt-oss-20b",
      messages: [],
    }),
    "workspace-a",
    dependencies({
      result: {
        status: "plan-unavailable",
        reason: "workspace plan not assigned",
      },
    })
  );

  assert.equal(noPlan.status, 403);

  const quota = await handleTokenUExecute(
    request({
      model: "gpt-oss-20b",
      messages: [],
    }),
    "workspace-a",
    dependencies({
      result: {
        status: "quota-denied",
        plan: {
          id: "starter",
          tier: "starter",
          monthlyCostLimit: 10,
          monthlyRequestLimit: 100,
          currency: "USD",
        },
        quota: {
          allowed: false,
          reason: "monthly request quota exceeded",
          remainingCost: 1,
          remainingRequests: 0,
        },
      },
    })
  );

  assert.equal(quota.status, 429);
});

test("TokenU execute returns translated successful upstream output without technical target metadata", async () => {
  const response = await handleTokenUExecute(
    request({
      model: "gpt-oss-20b",
      messages: [
        {
          role: "user",
          content: "hello",
        },
      ],
    }),
    "workspace-a",
    dependencies()
  );

  assert.equal(response.status, 200);

  assert.deepEqual(await response.json(), {
    id: "chatcmpl-test",
    choices: [
      {
        message: {
          role: "assistant",
          content: "hello",
        },
      },
    ],
  });
});

test("TokenU execute rejects query-string workspace selection", async () => {
  const response = await handleTokenUExecute(
    request(
      {
        model: "gpt-oss-20b",
        messages: [],
      },
      "http://localhost/api/v1/tokenu/execute?workspaceId=workspace-b"
    ),
    "workspace-a",
    dependencies()
  );

  assert.equal(response.status, 400);

  assert.deepEqual(await response.json(), {
    error: {
      code: "unsupported_query_parameter",
      message: "Unsupported query parameter: workspaceId",
    },
  });
});
