import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionAttemptContext } from "@/tokenu/contracts/executionAttemptContext";
import { OpenAIChatExecutionRequestFactory } from "@/tokenu/runtime/openAIChatExecutionRequestFactory";

const context: ExecutionAttemptContext = {
  requestId: "request-public",
  attemptId: "request-public-1",
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
  startedAt: "2026-09-09T12:00:00.000Z",
  retryNumber: 0,
};

test("OpenAI Chat request factory preserves runner-owned identity and target", () => {
  const payload = {
    model: "gpt-oss-20b",
    messages: [
      {
        role: "user",
        content: "hello",
      },
    ],
  } as const;

  const factory = new OpenAIChatExecutionRequestFactory({
    payload,
  });

  const request = factory.create(context);

  assert.equal(request.requestId, context.requestId);
  assert.equal(request.attemptId, context.attemptId);
  assert.equal(request.target, context.target);
  assert.equal(request.payload, payload);

  assert.equal(request.requestProtocol, "openai");
  assert.equal(request.clientResponseProtocol, "openai");
  assert.equal(request.stream, false);

  assert.deepEqual(request.responsesStatePolicy, {
    upstreamStore: false,
    preservePreviousResponseId: false,
  });

  assert.deepEqual(request.reasoningPolicy, {
    enabled: false,
    transport: "none",
    effort: null,
    budgetTokens: null,
    preserveReasoningContent: false,
    parseTextualReasoningTags: false,
  });

  assert.deepEqual(request.cachePolicy, {
    mechanism: "none",
    markerAction: "strip",
    synthesizedMarkerTtl: null,
  });

  assert.deepEqual(request.continuityPolicy, {
    constraints: [],
    crossProviderFallbackAllowed: false,
  });
});

test("OpenAI Chat request factory uses conservative non-streaming timeout defaults", () => {
  const request = new OpenAIChatExecutionRequestFactory({
    payload: {
      messages: [],
    },
  }).create(context);

  assert.deepEqual(request.timeoutPolicy, {
    attemptTimeoutMs: 30_000,
    upstreamStartTimeoutMs: null,
  });
});

test("OpenAI Chat request factory accepts explicit positive attempt timeout", () => {
  const request = new OpenAIChatExecutionRequestFactory({
    payload: {
      messages: [],
    },
    attemptTimeoutMs: 12_345,
  }).create(context);

  assert.equal(request.timeoutPolicy.attemptTimeoutMs, 12_345);
});

test("OpenAI Chat request factory rejects invalid attempt timeout", () => {
  assert.throws(
    () =>
      new OpenAIChatExecutionRequestFactory({
        payload: {
          messages: [],
        },
        attemptTimeoutMs: 0,
      }),
    /positive integer attempt timeout/
  );
});
