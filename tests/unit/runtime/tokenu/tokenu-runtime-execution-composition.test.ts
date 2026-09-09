import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { GROQ_OFFICIAL_CHAT_COMPLETIONS_URL } from "@/tokenu/adapters/groq/groqAdapterFactory";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type { TechnicalModelProfile } from "@/tokenu/contracts/model";
import type { ExecutionPlanRequestFactory } from "@/tokenu/runtime/executionPlanRunner";
import { DefaultAdapterFactoryRegistry } from "@/tokenu/runtime/defaultAdapterFactoryRegistry";
import { NullSecretResolver } from "@/tokenu/runtime/nullSecretResolver";
import { StaticEndpointProfileRegistry } from "@/tokenu/runtime/staticEndpointProfileRegistry";
import { StaticTechnicalModelProfileRegistry } from "@/tokenu/runtime/staticTechnicalModelProfileRegistry";
import {
  createTokenURuntimeComposition,
  type TokenURuntimeComposition,
} from "@/tokenu/runtime/tokenuRuntimeComposition";

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
  const db = new BetterSqlite3(":memory:");

  for (const migration of [
    "173_tokenu_workspace_identity.sql",
    "174_tokenu_workspace_plans.sql",
    "175_tokenu_usage_metering.sql",
    "176_tokenu_cost_ledger.sql",
    "177_tokenu_provider_pricing.sql",
    "178_tokenu_usage_projection_attempts.sql",
  ]) {
    db.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db as unknown as TokenUSqliteDatabase;
}

const technicalProfile: TechnicalModelProfile = {
  id: "groq-gpt-oss-20b-profile",
  upstreamProtocol: "openai",
  contextWindowTokens: null,
  maxOutputTokens: null,
  capabilities: {
    streaming: "supported",
    toolCalling: "supported",
    visionInput: "unknown",
    audioInput: "unsupported",
    audioOutput: "unsupported",
    structuredOutput: "unknown",
    jsonSchema: "unknown",
    webSearch: "unknown",
  },
  reasoning: {
    support: "supported",
    transport: "native",
    supportedEfforts: ["low", "medium", "high"],
  },
  toolNameMaxLength: null,
  unsupportedParameters: [],
  requestTimeoutMs: null,
};

const target = {
  providerId: "groq",
  modelOfferingId: "groq-gpt-oss-20b",
  upstreamModelId: "openai/gpt-oss-20b",
  connectionId: "groq-managed",
  credentialMode: "TOKENU_MANAGED",
  technicalProfileId: technicalProfile.id,
  adapterId: "groq-official-openai-v1",
  endpointProfileId: "groq-official-chat-completions",
  serviceRegion: null,
} as const;

function createRequestFactory(): ExecutionPlanRequestFactory {
  return {
    create(context) {
      return {
        requestId: context.requestId,
        attemptId: context.attemptId,
        target: context.target,
        continuityScope: null,
        payload: {
          messages: [
            {
              role: "user",
              content: "TOKENU P6F",
            },
          ],
        },
        requestProtocol: "openai",
        clientResponseProtocol: "openai",
        timeoutPolicy: {
          attemptTimeoutMs: 5000,
          upstreamStartTimeoutMs: null,
        },
        responsesStatePolicy: {
          upstreamStore: false,
          preservePreviousResponseId: false,
        },
        reasoningPolicy: {
          enabled: false,
          transport: "none",
          effort: null,
          budgetTokens: null,
          preserveReasoningContent: false,
          parseTextualReasoningTags: false,
        },
        cachePolicy: {
          mechanism: "none",
          markerAction: "strip",
          synthesizedMarkerTtl: null,
        },
        continuityPolicy: {
          constraints: [],
          crossProviderFallbackAllowed: false,
        },
        stream: false,
      };
    },
  };
}

async function prepareWorkspace(
  runtime: TokenURuntimeComposition,
  workspaceId: string
): Promise<void> {
  await runtime.workspaceRepository.save({
    id: workspaceId,
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  await runtime.workspacePlanRepository.save({
    id: "starter",
    tier: "starter",
    monthlyCostLimit: 100,
    monthlyRequestLimit: 100,
    currency: "USD",
  });

  await runtime.workspacePlanAssignmentRepository.save({
    workspaceId,
    planId: "starter",
    assignedAt: "2026-09-09T00:01:00.000Z",
  });
}

test("default production execution composition fails closed without configured technical dependencies", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const runtime = createTokenURuntimeComposition(asTokenUDatabase(db));

  assert.ok(runtime.secretResolver instanceof NullSecretResolver);

  await prepareWorkspace(runtime, "workspace-closed");

  const result = await runtime.tenantExecutionOrchestrator.execute({
    workspaceId: "workspace-closed",
    period: "2026-09",
    executionPlan: {
      requestId: "request-closed",
      attempts: [
        {
          sequence: 1,
          target,
        },
      ],
    },
    requestFactory: createRequestFactory(),
  });

  assert.equal(result.status, "executed");

  if (result.status !== "executed") {
    assert.fail("Expected admitted execution");
  }

  assert.equal(result.execution.status, "dispatch-failed");

  if (result.execution.status !== "dispatch-failed") {
    assert.fail("Expected fail-closed dispatch failure");
  }

  assert.equal(result.execution.error.code, "endpoint-not-found");

  assert.equal(
    (await runtime.workspaceRequestUsageRepository.get("workspace-closed", "2026-09"))
      ?.requestCount,
    1
  );

  assert.deepEqual(await runtime.costLedgerRepository.list("workspace-closed"), []);

  assert.equal(
    await runtime.workspaceUsageMeteringRepository.get("workspace-closed", "2026-09"),
    null
  );
});

test("injected reviewed dependencies execute through orchestrator runner dispatcher and Groq adapter", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  let upstreamCalls = 0;

  const runtime = createTokenURuntimeComposition(asTokenUDatabase(db), {
    endpointProfileRegistry: new StaticEndpointProfileRegistry([
      {
        id: target.endpointProfileId,
        url: GROQ_OFFICIAL_CHAT_COMPLETIONS_URL,
      },
    ]),
    technicalModelProfileRegistry: new StaticTechnicalModelProfileRegistry([technicalProfile]),
    secretResolver: {
      async resolve(connectionId) {
        if (connectionId !== target.connectionId) {
          return null;
        }

        return {
          kind: "api-key",
          value: "test-groq-secret",
        };
      },
    },
    adapterFactoryRegistry: new DefaultAdapterFactoryRegistry({
      fetchImpl: async () => {
        upstreamCalls += 1;

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "TOKENU P6F OK",
                },
              },
            ],
            usage: {
              prompt_tokens: 5,
              completion_tokens: 3,
              total_tokens: 8,
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }
        );
      },
    }),
  });

  await prepareWorkspace(runtime, "workspace-live");

  await runtime.providerPricingRepository.save({
    providerId: "groq",
    modelId: target.upstreamModelId,
    currency: "USD",
    inputTokenPricePerMillion: 1,
    outputTokenPricePerMillion: 2,
    effectiveFrom: "2026-09-01T00:00:00.000Z",
  });

  const result = await runtime.tenantExecutionOrchestrator.execute({
    workspaceId: "workspace-live",
    period: "2026-09",
    executionPlan: {
      requestId: "request-live",
      attempts: [
        {
          sequence: 1,
          target,
        },
      ],
    },
    requestFactory: createRequestFactory(),
  });

  assert.equal(result.status, "executed");

  if (result.status !== "executed") {
    assert.fail("Expected execution result");
  }

  assert.equal(result.execution.status, "completed");

  if (result.execution.status !== "completed") {
    assert.fail("Expected completed execution");
  }

  assert.equal(result.execution.result.status, "succeeded");
  assert.equal(result.execution.result.usage.totalTokens, 8);
  assert.equal(upstreamCalls, 1);

  const ledger = await runtime.costLedgerRepository.list("workspace-live");

  assert.equal(ledger.length, 1);
  assert.equal(ledger[0]?.attemptId, "request-live-1");
  assert.equal(ledger[0]?.providerId, "groq");
  assert.equal(ledger[0]?.inputTokens, 5);
  assert.equal(ledger[0]?.outputTokens, 3);

  const workspaceUsage = await runtime.workspaceUsageMeteringRepository.get(
    "workspace-live",
    "2026-09"
  );

  assert.equal(workspaceUsage?.meteredExecutionCount, 1);
  assert.equal(workspaceUsage?.inputTokens, 5);
  assert.equal(workspaceUsage?.outputTokens, 3);

  const providerUsage = await runtime.providerUsageRepository.get(
    "workspace-live",
    "2026-09",
    "groq",
    target.upstreamModelId
  );

  assert.equal(providerUsage?.requestCount, 1);
  assert.equal(providerUsage?.inputTokens, 5);
  assert.equal(providerUsage?.outputTokens, 3);
});
