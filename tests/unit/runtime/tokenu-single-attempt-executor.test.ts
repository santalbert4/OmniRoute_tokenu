import { test } from "node:test";
import assert from "node:assert/strict";

import type { CoreExecutionRequest } from "@/tokenu/contracts/coreExecutionRequest";
import type { CoreExecutionResult } from "@/tokenu/contracts/coreExecutionResult";
import type { SingleTargetAdapter } from "@/tokenu/contracts/singleTargetAdapter";

import { SingleAttemptExecutor } from "@/tokenu/runtime/singleAttemptExecutor";

const target = {
  providerId: "test-provider",
  modelOfferingId: "test-model",
  upstreamModelId: "test-upstream-model",
  connectionId: "test-connection",
  credentialMode: "platform-managed",
  technicalProfileId: "test-profile",
  adapterId: "test-adapter",
  endpointProfileId: "test-endpoint",
  serviceRegion: null,
} as const;

const request = {
  requestId: "req-1",
  attemptId: "attempt-1",
  target,
  continuityScope: null,
  payload: {},
  requestProtocol: "openai-responses",
  clientResponseProtocol: "openai-responses",
  timeoutPolicy: {
    attemptTimeoutMs: 30000,
    upstreamStartTimeoutMs: null,
  },
  responsesStatePolicy: {},
  reasoningPolicy: {},
  cachePolicy: {},
  continuityPolicy: {},
  stream: false,
} as CoreExecutionRequest;

const successResult = {
  requestId: "req-1",
  attemptId: "attempt-1",
  target,
  output: null,
  usage: {
    inputTokens: null,
    outputTokens: null,
    reasoningTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    totalTokens: null,
  },
  timing: {
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 1,
    timeToFirstByteMs: null,
  },
  status: "succeeded",
  error: null,
  retryability: "not-retryable",
  interruption: "none",
} satisfies CoreExecutionResult;

test("SingleAttemptExecutor executes exactly one approved adapter", async () => {
  let calls = 0;

  const adapter: SingleTargetAdapter = {
    id: "test-adapter",
    async execute() {
      calls++;
      return successResult;
    },
  };

  const registry = {
    resolve(id: string) {
      assert.equal(id, "test-adapter");
      return adapter;
    },
  };

  const executor = new SingleAttemptExecutor(registry);

  const result = await executor.execute(request);

  assert.equal(calls, 1);
  assert.equal(result.status, "succeeded");
});

test("SingleAttemptExecutor fails closed when adapter is missing", async () => {
  const registry = {
    resolve() {
      return null;
    },
  };

  const executor = new SingleAttemptExecutor(registry);

  const result = await executor.execute(request);

  assert.equal(result.status, "failed");
  assert.equal(result.error?.category, "unsupported");
});
