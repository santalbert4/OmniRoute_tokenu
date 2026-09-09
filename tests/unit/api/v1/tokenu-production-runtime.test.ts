import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { handleTokenUExecute } from "@/app/api/v1/tokenu/execute/executeHandler";
import { handleTokenUExecuteRoute } from "@/app/api/v1/tokenu/execute/route";
import { createTokenUProductionRuntimeComposition } from "@/app/api/v1/tokenu/productionRuntime";
import { resolveTokenUTenantAuth } from "@/app/api/v1/tokenu/tenantAuth";
import { GROQ_OFFICIAL_CHAT_COMPLETIONS_URL } from "@/tokenu/adapters/groq/groqAdapterFactory";
import { AesGcmCredentialCipher } from "@/tokenu/adapters/security/aesGcmCredentialCipher";
import { SqliteProviderConnectionRepository } from "@/tokenu/adapters/storage/sqliteProviderConnectionRepository";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import {
  GROQ_GPT_OSS_20B_PROVIDER_PRICING,
  GROQ_MANAGED_CONNECTION_ID,
} from "@/tokenu/runtime/productionGroqCatalog";
import { ProviderConnectionService } from "@/tokenu/runtime/providerConnectionService";

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

const masterKey = "tokenu-production-test-master-key-0123456789abcdef";

function createDatabase(): RawDatabase {
  const db = new BetterSqlite3(":memory:");

  for (const migration of [
    "173_tokenu_workspace_identity.sql",
    "174_tokenu_workspace_plans.sql",
    "175_tokenu_usage_metering.sql",
    "176_tokenu_cost_ledger.sql",
    "177_tokenu_provider_pricing.sql",
    "178_tokenu_usage_projection_attempts.sql",
    "179_tokenu_provider_connections.sql",
    "180_tokenu_provider_pricing_cache.sql",
    "181_tokenu_api_keys.sql",
  ]) {
    db.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db as unknown as TokenUSqliteDatabase;
}

async function provisionGroq(
  db: RawDatabase,
  options?: {
    readonly enabled?: boolean;
    readonly encryptionKey?: string;
  }
): Promise<void> {
  const repository = new SqliteProviderConnectionRepository(asTokenUDatabase(db));

  const cipher = new AesGcmCredentialCipher(options?.encryptionKey ?? masterKey);

  const service = new ProviderConnectionService(repository, cipher);

  await service.saveManagedCredential({
    connectionId: GROQ_MANAGED_CONNECTION_ID,
    providerId: "groq",
    credentialKind: "api-key",
    plaintextCredential: "gsk_runtime_test_secret",
    enabled: options?.enabled ?? true,
    recordedAt: "2026-09-09T00:00:00.000Z",
  });
}

test("production TokenU runtime remains fail closed without groq-managed connection", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const runtime = await createTokenUProductionRuntimeComposition({
    database: asTokenUDatabase(db),
    credentialMasterKey: masterKey,
  });

  assert.equal(
    runtime.publicExecutionResolver.resolve({
      requestId: "request-no-groq",
      publicModelId: "gpt-oss-20b",
    }),
    null
  );
});

test("production TokenU runtime remains fail closed when groq-managed connection is disabled", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  await provisionGroq(db, {
    enabled: false,
  });

  const runtime = await createTokenUProductionRuntimeComposition({
    database: asTokenUDatabase(db),
    credentialMasterKey: masterKey,
  });

  assert.equal(
    runtime.publicExecutionResolver.resolve({
      requestId: "request-disabled-groq",
      publicModelId: "gpt-oss-20b",
    }),
    null
  );
});

test("production TokenU runtime activates exact Groq route only after managed credential validation", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  await provisionGroq(db);

  const runtime = await createTokenUProductionRuntimeComposition({
    database: asTokenUDatabase(db),
    credentialMasterKey: masterKey,
  });

  const plan = runtime.publicExecutionResolver.resolve({
    requestId: "request-production-groq",
    publicModelId: "gpt-oss-20b",
  });

  assert.ok(plan);

  assert.equal(plan.attempts.length, 1);

  assert.deepEqual(plan.attempts[0]?.target, {
    providerId: "groq",
    modelOfferingId: "groq:openai/gpt-oss-20b",
    upstreamModelId: "openai/gpt-oss-20b",
    connectionId: "groq-managed",
    credentialMode: "TOKENU_MANAGED",
    technicalProfileId: "groq-gpt-oss-20b-profile",
    adapterId: "groq-official-openai-v1",
    endpointProfileId: "groq-official-chat-completions",
    serviceRegion: null,
  });

  const pricing = await runtime.providerPricingRepository.findEffective(
    "groq",
    "openai/gpt-oss-20b",
    "2026-09-09T12:00:00.000Z"
  );

  assert.ok(pricing);

  assert.equal(pricing.providerId, GROQ_GPT_OSS_20B_PROVIDER_PRICING.providerId);

  assert.equal(pricing.modelId, GROQ_GPT_OSS_20B_PROVIDER_PRICING.modelId);

  assert.equal(pricing.currency, GROQ_GPT_OSS_20B_PROVIDER_PRICING.currency);

  assert.equal(
    pricing.inputTokenPricePerMillion,
    GROQ_GPT_OSS_20B_PROVIDER_PRICING.inputTokenPricePerMillion
  );

  assert.equal(
    pricing.outputTokenPricePerMillion,
    GROQ_GPT_OSS_20B_PROVIDER_PRICING.outputTokenPricePerMillion
  );

  assert.equal(
    pricing.cacheReadTokenPricePerMillion,
    GROQ_GPT_OSS_20B_PROVIDER_PRICING.cacheReadTokenPricePerMillion
  );

  assert.equal(
    pricing.cacheWriteTokenPricePerMillion ?? null,
    GROQ_GPT_OSS_20B_PROVIDER_PRICING.cacheWriteTokenPricePerMillion ?? null
  );

  assert.equal(pricing.effectiveFrom, GROQ_GPT_OSS_20B_PROVIDER_PRICING.effectiveFrom);
});

test("production TokenU runtime executes the controlled P6I Groq path through encrypted credentials and persistent billing", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  await provisionGroq(db);

  const connectionRepository = new SqliteProviderConnectionRepository(asTokenUDatabase(db));

  const storedConnection = await connectionRepository.get(GROQ_MANAGED_CONNECTION_ID);

  assert.ok(storedConnection);

  assert.match(storedConnection.encryptedCredential, /^tokenu:cred:v1:/);

  assert.equal(storedConnection.encryptedCredential.includes("gsk_runtime_test_secret"), false);

  let upstreamCalls = 0;
  let capturedUrl = "";
  let capturedAuthorization: string | null = null;
  let capturedModel: unknown = null;

  const fetchStub: typeof fetch = async (input, init): Promise<Response> => {
    upstreamCalls += 1;

    capturedUrl = String(input);

    const headers = new Headers(init?.headers);

    capturedAuthorization = headers.get("authorization");

    const sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

    capturedModel = sentBody.model;

    return new Response(
      JSON.stringify({
        id: "chatcmpl-p6i-controlled",
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "TOKENU P6I CONTROLLED OK",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 88,
          completion_tokens: 132,
          total_tokens: 220,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  };

  const originalFetch = globalThis.fetch;

  let runtime: Awaited<ReturnType<typeof createTokenUProductionRuntimeComposition>>;

  try {
    globalThis.fetch = fetchStub;

    runtime = await createTokenUProductionRuntimeComposition({
      database: asTokenUDatabase(db),

      credentialMasterKey: masterKey,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  await runtime.workspaceRepository.save({
    id: "workspace-p6i-controlled",
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  await runtime.workspacePlanRepository.save({
    id: "p6i-controlled-pro",
    tier: "pro",
    monthlyCostLimit: 10,
    monthlyRequestLimit: 100,
    currency: "USD",
  });

  await runtime.workspacePlanAssignmentRepository.save({
    workspaceId: "workspace-p6i-controlled",
    planId: "p6i-controlled-pro",
    assignedAt: "2026-09-09T00:01:00.000Z",
  });

  const response = await handleTokenUExecute(
    new Request("http://localhost/api/v1/tokenu/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-oss-20b",
        messages: [
          {
            role: "user",
            content: "TOKENU P6I CONTROLLED",
          },
        ],
        stream: false,
      }),
    }),
    "workspace-p6i-controlled",
    {
      publicExecutionResolver: runtime.publicExecutionResolver,

      tenantExecutionOrchestrator: runtime.tenantExecutionOrchestrator,

      generateRequestId() {
        return "request-p6i-controlled";
      },

      currentPeriod() {
        return "2026-09";
      },
    }
  );

  assert.equal(response.status, 200);

  const responseBody = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  assert.equal(responseBody.choices?.[0]?.message?.content, "TOKENU P6I CONTROLLED OK");

  assert.equal(upstreamCalls, 1);

  assert.equal(capturedUrl, GROQ_OFFICIAL_CHAT_COMPLETIONS_URL);

  assert.equal(capturedAuthorization, "Bearer gsk_runtime_test_secret");

  assert.equal(capturedModel, "openai/gpt-oss-20b");

  const requestUsage = await runtime.workspaceRequestUsageRepository.get(
    "workspace-p6i-controlled",
    "2026-09"
  );

  assert.equal(requestUsage?.requestCount, 1);

  const ledger = await runtime.costLedgerRepository.list("workspace-p6i-controlled");

  assert.equal(ledger.length, 1);

  assert.deepEqual(ledger[0], {
    workspaceId: "workspace-p6i-controlled",

    requestId: "request-p6i-controlled",

    attemptId: "request-p6i-controlled-1",

    providerId: "groq",

    modelId: "openai/gpt-oss-20b",

    currency: "USD",

    inputTokens: 88,

    outputTokens: 132,

    totalTokens: 220,

    cost: 0.000046,

    createdAt: ledger[0]?.createdAt,
  });

  assert.ok(ledger[0]?.createdAt);

  const rawLedger = db
    .prepare(
      `SELECT
         cost_micros,
         input_tokens,
         output_tokens,
         total_tokens
       FROM tokenu_cost_ledger
       WHERE workspace_id = ?
         AND attempt_id = ?`
    )
    .get("workspace-p6i-controlled", "request-p6i-controlled-1") as {
    cost_micros: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };

  assert.deepEqual(rawLedger, {
    cost_micros: 46,
    input_tokens: 88,
    output_tokens: 132,
    total_tokens: 220,
  });

  const rawProjection = db
    .prepare(
      `SELECT
         estimated_cost_micros,
         input_tokens,
         output_tokens
       FROM tokenu_usage_projection_attempts
       WHERE workspace_id = ?
         AND attempt_id = ?`
    )
    .get("workspace-p6i-controlled", "request-p6i-controlled-1") as {
    estimated_cost_micros: number;
    input_tokens: number;
    output_tokens: number;
  };

  assert.deepEqual(rawProjection, {
    estimated_cost_micros: 46,
    input_tokens: 88,
    output_tokens: 132,
  });

  const workspaceUsage = await runtime.workspaceUsageMeteringRepository.get(
    "workspace-p6i-controlled",
    "2026-09"
  );

  assert.deepEqual(workspaceUsage, {
    workspaceId: "workspace-p6i-controlled",

    period: "2026-09",

    meteredExecutionCount: 1,

    inputTokens: 88,

    outputTokens: 132,

    estimatedCost: 0.000046,
  });

  const providerUsage = await runtime.providerUsageRepository.get(
    "workspace-p6i-controlled",
    "2026-09",
    "groq",
    "openai/gpt-oss-20b"
  );

  assert.deepEqual(providerUsage, {
    workspaceId: "workspace-p6i-controlled",

    period: "2026-09",

    providerId: "groq",

    modelId: "openai/gpt-oss-20b",

    requestCount: 1,

    inputTokens: 88,

    outputTokens: 132,

    estimatedCost: 0.000046,
  });
});

test("production TokenU execute route authenticates a TokenU-owned key before controlled provider execution", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  await provisionGroq(db);

  let upstreamCalls = 0;
  let capturedUrl = "";
  let capturedAuthorization: string | null = null;
  let capturedModel: unknown = null;

  const fetchStub: typeof fetch = async (input, init): Promise<Response> => {
    upstreamCalls += 1;

    capturedUrl = String(input);

    const headers = new Headers(init?.headers);

    capturedAuthorization = headers.get("authorization");

    const sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

    capturedModel = sentBody.model;

    return new Response(
      JSON.stringify({
        id: "chatcmpl-p7d-controlled",
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "TOKENU P7D AUTH EXECUTE OK",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 88,
          completion_tokens: 132,
          total_tokens: 220,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  };

  const originalFetch = globalThis.fetch;

  let runtime: Awaited<ReturnType<typeof createTokenUProductionRuntimeComposition>>;

  try {
    globalThis.fetch = fetchStub;

    runtime = await createTokenUProductionRuntimeComposition({
      database: asTokenUDatabase(db),
      credentialMasterKey: masterKey,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const workspaceId = "workspace-p7d-controlled";

  await runtime.workspaceRepository.save({
    id: workspaceId,
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  await runtime.workspacePlanRepository.save({
    id: "p7d-controlled-pro",
    tier: "pro",
    monthlyCostLimit: 10,
    monthlyRequestLimit: 100,
    currency: "USD",
  });

  await runtime.workspacePlanAssignmentRepository.save({
    workspaceId,
    planId: "p7d-controlled-pro",
    assignedAt: "2026-09-10T00:01:00.000Z",
  });

  const clientKey = await runtime.tokenUApiKeyService.create({
    name: "P7D controlled client",
    createdAt: "2026-09-10T00:02:00.000Z",
  });

  await runtime.workspacePrincipalRepository.save({
    workspaceId,
    principalType: "api_key",
    principalId: clientKey.id,
    assignedAt: "2026-09-10T00:03:00.000Z",
  });

  const unassignedKey = await runtime.tokenUApiKeyService.create({
    name: "P7D unassigned client",
    createdAt: "2026-09-10T00:04:00.000Z",
  });

  function executionRequest(bearer: string, extraBody: Record<string, unknown> = {}): Request {
    return new Request("http://localhost/api/v1/tokenu/execute", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-oss-20b",
        messages: [
          {
            role: "user",
            content: "TOKENU P7D CONTROLLED",
          },
        ],
        stream: false,
        ...extraBody,
      }),
    });
  }

  async function executeThroughPublicRoute(request: Request): Promise<Response> {
    return handleTokenUExecuteRoute(request, {
      resolveTenantAuth(authRequest) {
        return resolveTokenUTenantAuth(authRequest, {
          resolveApiKeyPrincipalId(apiKey) {
            return runtime.tokenUApiKeyService.resolvePrincipalId(
              apiKey,
              "2026-09-10T12:00:00.000Z"
            );
          },

          workspacePrincipalRepository: runtime.workspacePrincipalRepository,
        });
      },

      handleResolvedExecution(executionRequestValue, resolvedWorkspaceId) {
        return handleTokenUExecute(executionRequestValue, resolvedWorkspaceId, {
          publicExecutionResolver: runtime.publicExecutionResolver,

          tenantExecutionOrchestrator: runtime.tenantExecutionOrchestrator,

          generateRequestId() {
            return "request-p7d-controlled";
          },

          currentPeriod() {
            return "2026-09";
          },
        });
      },
    });
  }

  const response = await executeThroughPublicRoute(executionRequest(clientKey.token));

  assert.equal(response.status, 200);

  const responseBody = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  assert.equal(responseBody.choices?.[0]?.message?.content, "TOKENU P7D AUTH EXECUTE OK");

  assert.equal(upstreamCalls, 1);

  assert.equal(capturedUrl, GROQ_OFFICIAL_CHAT_COMPLETIONS_URL);

  assert.equal(capturedAuthorization, "Bearer gsk_runtime_test_secret");

  assert.notEqual(capturedAuthorization, `Bearer ${clientKey.token}`);

  assert.equal(capturedModel, "openai/gpt-oss-20b");

  const storedClientKey = db
    .prepare(
      `SELECT
         id,
         key_prefix,
         key_hash,
         last_used_at
       FROM tokenu_api_keys
       WHERE id = ?`
    )
    .get(clientKey.id) as {
    id: string;
    key_prefix: string;
    key_hash: string;
    last_used_at: string | null;
  };

  assert.equal(storedClientKey.id, clientKey.id);

  assert.equal(storedClientKey.key_prefix, clientKey.keyPrefix);

  assert.match(storedClientKey.key_hash, /^[0-9a-f]{64}$/);

  assert.equal(storedClientKey.last_used_at, "2026-09-10T12:00:00.000Z");

  assert.equal(JSON.stringify(storedClientKey).includes(clientKey.token), false);

  const binding = await runtime.workspacePrincipalRepository.get("api_key", clientKey.id);

  assert.equal(binding?.workspaceId, workspaceId);

  const requestUsage = await runtime.workspaceRequestUsageRepository.get(workspaceId, "2026-09");

  assert.equal(requestUsage?.requestCount, 1);

  const ledger = await runtime.costLedgerRepository.list(workspaceId);

  assert.equal(ledger.length, 1);

  assert.deepEqual(ledger[0], {
    workspaceId,
    requestId: "request-p7d-controlled",
    attemptId: "request-p7d-controlled-1",
    providerId: "groq",
    modelId: "openai/gpt-oss-20b",
    currency: "USD",
    inputTokens: 88,
    outputTokens: 132,
    totalTokens: 220,
    cost: 0.000046,
    createdAt: ledger[0]?.createdAt,
  });

  const rawLedger = db
    .prepare(
      `SELECT
         cost_micros,
         input_tokens,
         output_tokens,
         total_tokens
       FROM tokenu_cost_ledger
       WHERE workspace_id = ?
         AND attempt_id = ?`
    )
    .get(workspaceId, "request-p7d-controlled-1") as {
    cost_micros: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };

  assert.deepEqual(rawLedger, {
    cost_micros: 46,
    input_tokens: 88,
    output_tokens: 132,
    total_tokens: 220,
  });

  const unassignedResponse = await executeThroughPublicRoute(executionRequest(unassignedKey.token));

  assert.equal(unassignedResponse.status, 403);

  assert.deepEqual(await unassignedResponse.json(), {
    error: {
      code: "workspace_not_assigned",
      message: "API key is not assigned to a TokenU workspace",
    },
  });

  assert.equal(upstreamCalls, 1);

  const legacyBearerResponse = await executeThroughPublicRoute(
    executionRequest("gsk_runtime_test_secret")
  );

  assert.equal(legacyBearerResponse.status, 401);

  assert.deepEqual(await legacyBearerResponse.json(), {
    error: {
      code: "unauthorized",
      message: "Unauthorized",
    },
  });

  assert.equal(upstreamCalls, 1);

  const workspaceOverrideResponse = await executeThroughPublicRoute(
    executionRequest(clientKey.token, {
      workspaceId: "workspace-attacker",
    })
  );

  assert.equal(workspaceOverrideResponse.status, 400);

  assert.deepEqual(await workspaceOverrideResponse.json(), {
    error: {
      code: "internal_field_not_allowed",
      message: 'Field "workspaceId" is not allowed in the public TokenU execution API',
    },
  });

  assert.equal(upstreamCalls, 1);

  assert.equal(
    (await runtime.workspaceRequestUsageRepository.get(workspaceId, "2026-09"))?.requestCount,
    1
  );

  assert.equal((await runtime.costLedgerRepository.list(workspaceId)).length, 1);
});

test("production TokenU runtime rejects an enabled managed connection encrypted under another master key", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  await provisionGroq(db, {
    encryptionKey: "another-production-master-key-0123456789abcdef",
  });

  await assert.rejects(
    createTokenUProductionRuntimeComposition({
      database: asTokenUDatabase(db),
      credentialMasterKey: masterKey,
    }),
    /credential could not be decrypted/
  );
});

test("production TokenU runtime rejects blank master key input", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  await assert.rejects(
    createTokenUProductionRuntimeComposition({
      database: asTokenUDatabase(db),
      credentialMasterKey: " ",
    }),
    /requires a credential master key/
  );
});
