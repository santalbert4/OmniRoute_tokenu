import assert from "node:assert/strict";
import test from "node:test";

import { TenantUsageProjectionCollector } from "@/tokenu/runtime/tenantUsageProjectionCollector";

const target = {
  providerId: "groq",
  modelOfferingId: "groq:test",
  upstreamModelId: "llama-test",
  connectionId: "groq-connection",
  credentialMode: "TOKENU_MANAGED",
  technicalProfileId: "groq-profile",
  adapterId: "groq-openai",
  endpointProfileId: "default",
  serviceRegion: null,
} as const;

const context = {
  requestId: "request-1",
  attemptId: "attempt-1",
  sequence: 1,
  target,
  startedAt: "2026-09-09T12:00:00.000Z",
  retryNumber: 0,
} as const;

test("tenant usage projection collector projects completed attempt against trusted workspace", async () => {
  let record: unknown = null;

  const service = {
    async recordExecution(input: unknown) {
      record = input;
      return true;
    },
  };

  const collector = new TenantUsageProjectionCollector("workspace-a", service);

  await collector.consume({
    type: "attempt-completed",
    context,
    result: {
      requestId: "request-1",
      attemptId: "attempt-1",
      target,
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

  assert.deepEqual(record, {
    workspaceId: "workspace-a",
    requestId: "request-1",
    attemptId: "attempt-1",
    providerId: "groq",
    modelId: "llama-test",
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      reasoningTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: 1500,
    },
    recordedAt: "2026-09-09T12:00:01.000Z",
  });
});

test("tenant usage projection collector ignores non-completed execution events", async () => {
  let calls = 0;

  const service = {
    async recordExecution() {
      calls += 1;
      return true;
    },
  };

  const collector = new TenantUsageProjectionCollector("workspace-a", service);

  await collector.consume({
    type: "attempt-started",
    context,
  });

  await collector.consume({
    type: "attempt-dispatch-failed",
    context,
    error: {
      code: "adapter-not-found",
      message: "adapter unavailable",
    },
  });

  assert.equal(calls, 0);
});

test("tenant usage projection collector rejects blank workspace identity", () => {
  const service = {
    async recordExecution() {
      return true;
    },
  };

  assert.throws(
    () => new TenantUsageProjectionCollector("   ", service),
    /requires workspace identity/
  );
});
