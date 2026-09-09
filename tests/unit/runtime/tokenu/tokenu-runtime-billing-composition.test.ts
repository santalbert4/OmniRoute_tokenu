import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import { createTokenURuntimeComposition } from "@/tokenu/runtime/tokenuRuntimeComposition";

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

  close(): void;
}

const require = createRequire(import.meta.url);

const BetterSqlite3 = require("better-sqlite3") as new (filename: string) => RawDatabase;

function createDatabase(): RawDatabase {
  const db = new BetterSqlite3(":memory:");

  for (const migration of [
    "173_tokenu_workspace_identity.sql",
    "175_tokenu_usage_metering.sql",
    "176_tokenu_cost_ledger.sql",
    "177_tokenu_provider_pricing.sql",
    "178_tokenu_usage_projection_attempts.sql",
    "180_tokenu_provider_pricing_cache.sql",
  ]) {
    db.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db as unknown as TokenUSqliteDatabase;
}

test("TokenU runtime billing uses historical persistent pricing and records authoritative ledger cost", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const runtime = createTokenURuntimeComposition(asTokenUDatabase(db));

  await runtime.workspaceRepository.save({
    id: "workspace-billing",
    createdAt: "2026-09-01T00:00:00.000Z",
  });

  await runtime.providerPricingRepository.save({
    providerId: "openai",
    modelId: "gpt-billing-test",
    currency: "USD",
    inputTokenPricePerMillion: 1.5,
    outputTokenPricePerMillion: 6,
    effectiveFrom: "2026-06-01T00:00:00.000Z",
  });

  await runtime.providerPricingRepository.save({
    providerId: "openai",
    modelId: "gpt-billing-test",
    currency: "USD",
    inputTokenPricePerMillion: 10,
    outputTokenPricePerMillion: 20,
    effectiveFrom: "2026-10-01T00:00:00.000Z",
  });

  const first = await runtime.costLedgerService.recordExecution({
    workspaceId: "workspace-billing",
    requestId: "request-september",
    attemptId: "attempt-september",
    providerId: "openai",
    modelId: "gpt-billing-test",
    usage: {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      reasoningTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: 1_500_000,
    },
    recordedAt: "2026-09-15T12:00:00.000Z",
  });

  assert.deepEqual(first, {
    recorded: true,
    cost: 4.5,
    entryId: "attempt-september",
  });

  const duplicate = await runtime.costLedgerService.recordExecution({
    workspaceId: "workspace-billing",
    requestId: "request-september",
    attemptId: "attempt-september",
    providerId: "openai",
    modelId: "gpt-billing-test",
    usage: {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      reasoningTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: 1_500_000,
    },
    recordedAt: "2026-09-15T12:00:00.000Z",
  });

  assert.deepEqual(duplicate, {
    recorded: false,
    cost: 0,
    entryId: "attempt-september",
  });

  assert.deepEqual(await runtime.costLedgerRepository.list("workspace-billing"), [
    {
      workspaceId: "workspace-billing",
      requestId: "request-september",
      attemptId: "attempt-september",
      providerId: "openai",
      modelId: "gpt-billing-test",
      currency: "USD",
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      totalTokens: 1_500_000,
      cost: 4.5,
      createdAt: "2026-09-15T12:00:00.000Z",
    },
  ]);

  const raw = db
    .prepare(
      `SELECT
         cost_micros,
         typeof(cost_micros) AS cost_type
       FROM tokenu_cost_ledger
       WHERE workspace_id = ?
         AND attempt_id = ?`
    )
    .get("workspace-billing", "attempt-september") as {
    cost_micros: number;
    cost_type: string;
  };

  assert.deepEqual(raw, {
    cost_micros: 4_500_000,
    cost_type: "integer",
  });
});

test("TokenU runtime persists the real P6I Groq billing case after cache normalization", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const runtime = createTokenURuntimeComposition(asTokenUDatabase(db));

  await runtime.workspaceRepository.save({
    id: "workspace-p6i-groq",
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  await runtime.providerPricingRepository.save({
    providerId: "groq",
    modelId: "openai/gpt-oss-20b",
    currency: "USD",
    inputTokenPricePerMillion: 0.075,
    outputTokenPricePerMillion: 0.3,
    cacheReadTokenPricePerMillion: 0.037,
    cacheWriteTokenPricePerMillion: null,
    effectiveFrom: "2026-09-09T00:00:00.000Z",
  });

  const sink = runtime.tenantExecutionEventSinkFactory.create("workspace-p6i-groq");

  await sink.emit({
    type: "attempt-completed",
    context: {
      requestId: "request-p6i-groq",
      attemptId: "attempt-p6i-groq-1",
      sequence: 1,
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
      startedAt: "2026-09-09T22:32:52.000Z",
      retryNumber: 0,
    },
    result: {
      requestId: "request-p6i-groq",
      attemptId: "attempt-p6i-groq-1",
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
      output: null,
      usage: {
        inputTokens: 87,
        outputTokens: 112,
        reasoningTokens: null,
        cacheReadTokens: 0,
        cacheWriteTokens: null,
        totalTokens: 199,
      },
      timing: {
        startedAt: "2026-09-09T22:32:52.000Z",
        completedAt: "2026-09-09T22:32:53.067Z",
        durationMs: 1067,
        timeToFirstByteMs: null,
      },
      status: "succeeded",
      error: null,
      retryability: "not-retryable",
      interruption: "none",
    },
  });

  const ledgerEntries = await runtime.costLedgerRepository.list("workspace-p6i-groq");

  assert.deepEqual(ledgerEntries, [
    {
      workspaceId: "workspace-p6i-groq",
      requestId: "request-p6i-groq",
      attemptId: "attempt-p6i-groq-1",
      providerId: "groq",
      modelId: "openai/gpt-oss-20b",
      currency: "USD",
      inputTokens: 87,
      outputTokens: 112,
      totalTokens: 199,
      cost: 0.00004,
      createdAt: "2026-09-09T22:32:53.067Z",
    },
  ]);

  const rawLedger = db
    .prepare(
      `SELECT
         input_tokens,
         output_tokens,
         total_tokens,
         cost_micros,
         typeof(cost_micros) AS cost_type
       FROM tokenu_cost_ledger
       WHERE workspace_id = ?
         AND attempt_id = ?`
    )
    .get("workspace-p6i-groq", "attempt-p6i-groq-1") as {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_micros: number;
    cost_type: string;
  };

  assert.deepEqual(rawLedger, {
    input_tokens: 87,
    output_tokens: 112,
    total_tokens: 199,
    cost_micros: 40,
    cost_type: "integer",
  });

  const rawProjection = db
    .prepare(
      `SELECT
         request_id,
         attempt_id,
         provider_id,
         model_id,
         input_tokens,
         output_tokens,
         estimated_cost_micros
       FROM tokenu_usage_projection_attempts
       WHERE workspace_id = ?
         AND attempt_id = ?`
    )
    .get("workspace-p6i-groq", "attempt-p6i-groq-1") as {
    request_id: string;
    attempt_id: string;
    provider_id: string;
    model_id: string;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_micros: number;
  };

  assert.deepEqual(rawProjection, {
    request_id: "request-p6i-groq",
    attempt_id: "attempt-p6i-groq-1",
    provider_id: "groq",
    model_id: "openai/gpt-oss-20b",
    input_tokens: 87,
    output_tokens: 112,
    estimated_cost_micros: 40,
  });

  const workspaceUsage = await runtime.workspaceUsageMeteringRepository.get(
    "workspace-p6i-groq",
    "2026-09"
  );

  assert.deepEqual(workspaceUsage, {
    workspaceId: "workspace-p6i-groq",
    period: "2026-09",
    meteredExecutionCount: 1,
    inputTokens: 87,
    outputTokens: 112,
    estimatedCost: 0.00004,
  });

  const providerUsage = await runtime.providerUsageRepository.get(
    "workspace-p6i-groq",
    "2026-09",
    "groq",
    "openai/gpt-oss-20b"
  );

  assert.deepEqual(providerUsage, {
    workspaceId: "workspace-p6i-groq",
    period: "2026-09",
    providerId: "groq",
    modelId: "openai/gpt-oss-20b",
    requestCount: 1,
    inputTokens: 87,
    outputTokens: 112,
    estimatedCost: 0.00004,
  });
});

test("TokenU runtime tenant event pipeline bills through persistent composition", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const runtime = createTokenURuntimeComposition(asTokenUDatabase(db));

  await runtime.workspaceRepository.save({
    id: "workspace-pipeline",
    createdAt: "2026-09-01T00:00:00.000Z",
  });

  await runtime.providerPricingRepository.save({
    providerId: "groq",
    modelId: "llama-pipeline-test",
    currency: "USD",
    inputTokenPricePerMillion: 1,
    outputTokenPricePerMillion: 2,
    effectiveFrom: "2026-09-01T00:00:00.000Z",
  });

  const sink = runtime.tenantExecutionEventSinkFactory.create("workspace-pipeline");

  await sink.emit({
    type: "attempt-completed",
    context: {
      requestId: "request-pipeline",
      attemptId: "attempt-pipeline",
      sequence: 1,
      target: {
        providerId: "groq",
        modelOfferingId: "groq:pipeline-test",
        upstreamModelId: "llama-pipeline-test",
        connectionId: "groq-pipeline",
        credentialMode: "TOKENU_MANAGED",
        technicalProfileId: "groq-pipeline-profile",
        adapterId: "groq-openai",
        endpointProfileId: "default",
        serviceRegion: null,
      },
      startedAt: "2026-09-09T12:00:00.000Z",
      retryNumber: 0,
    },
    result: {
      requestId: "request-pipeline",
      attemptId: "attempt-pipeline",
      target: {
        providerId: "groq",
        modelOfferingId: "groq:pipeline-test",
        upstreamModelId: "llama-pipeline-test",
        connectionId: "groq-pipeline",
        credentialMode: "TOKENU_MANAGED",
        technicalProfileId: "groq-pipeline-profile",
        adapterId: "groq-openai",
        endpointProfileId: "default",
        serviceRegion: null,
      },
      output: null,
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        reasoningTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
        totalTokens: 1500,
      },
      timing: {
        startedAt: "2026-09-09T12:00:00.000Z",
        completedAt: "2026-09-09T12:00:01.000Z",
        durationMs: 1000,
        timeToFirstByteMs: null,
      },
      status: "succeeded",
      error: null,
      retryability: "not-retryable",
      interruption: "none",
    },
  });

  const entries = await runtime.costLedgerRepository.list("workspace-pipeline");

  assert.equal(entries.length, 1);

  assert.equal(entries[0]?.attemptId, "attempt-pipeline");

  assert.ok(Math.abs((entries[0]?.cost ?? 0) - 0.002) < 1e-12);

  const workspaceUsage = await runtime.workspaceUsageMeteringRepository.get(
    "workspace-pipeline",
    "2026-09"
  );

  assert.deepEqual(workspaceUsage, {
    workspaceId: "workspace-pipeline",
    period: "2026-09",
    meteredExecutionCount: 1,
    inputTokens: 1000,
    outputTokens: 500,
    estimatedCost: 0.002,
  });

  const providerUsage = await runtime.providerUsageRepository.get(
    "workspace-pipeline",
    "2026-09",
    "groq",
    "llama-pipeline-test"
  );

  assert.deepEqual(providerUsage, {
    workspaceId: "workspace-pipeline",
    period: "2026-09",
    providerId: "groq",
    modelId: "llama-pipeline-test",
    requestCount: 1,
    inputTokens: 1000,
    outputTokens: 500,
    estimatedCost: 0.002,
  });
});
