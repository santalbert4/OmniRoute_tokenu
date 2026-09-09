import assert from "node:assert/strict";
import test from "node:test";

import {
  GROQ_ADAPTER_ID,
  GROQ_OFFICIAL_CHAT_COMPLETIONS_URL,
  GroqAdapterFactory,
} from "@/tokenu/adapters/groq/groqAdapterFactory";
import type { NonStreamingCoreExecutionRequest } from "@/tokenu/contracts/coreExecutionRequest";
import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";
import type { JsonValue } from "@/tokenu/contracts/json";
import type { TechnicalModelProfile } from "@/tokenu/contracts/model";
import type { SingleTargetAdapterBinding } from "@/tokenu/runtime/adapterRegistry";

const target: ExecutionTarget = {
  providerId: "groq",
  modelOfferingId: "groq-gpt-oss-20b",
  upstreamModelId: "openai/gpt-oss-20b",
  connectionId: "groq-test-connection",
  credentialMode: "TOKENU_MANAGED",
  technicalProfileId: "groq-gpt-oss-20b-profile",
  adapterId: GROQ_ADAPTER_ID,
  endpointProfileId: "groq-official-chat-completions",
  serviceRegion: null,
};

const technicalModelProfile: TechnicalModelProfile = {
  id: target.technicalProfileId,
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
  unsupportedParameters: [
    "logprobs",
    "logit_bias",
    "top_logprobs",
    "metadata",
    "store",
    "frequency_penalty",
    "presence_penalty",
  ],
  requestTimeoutMs: null,
};

function createBinding(): SingleTargetAdapterBinding {
  return {
    target,
    endpoint: {
      id: target.endpointProfileId,
      url: GROQ_OFFICIAL_CHAT_COMPLETIONS_URL,
    },
    credential: {
      kind: "api-key",
      value: "test-groq-secret",
    },
    technicalModelProfile,
  };
}

function createRequest(
  payload: JsonValue = {
    model: "client-controlled-model",
    stream: true,
    messages: [
      {
        role: "user",
        content: "hello",
      },
    ],
  }
): NonStreamingCoreExecutionRequest {
  return {
    requestId: "request-1",
    attemptId: "attempt-1",
    target,
    continuityScope: null,
    payload,
    requestProtocol: "openai",
    clientResponseProtocol: "openai",
    timeoutPolicy: {
      attemptTimeoutMs: 1_000,
      upstreamStartTimeoutMs: 500,
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
      crossProviderFallbackAllowed: true,
    },
    stream: false,
  };
}

test("Groq factory fails closed for a non-Groq target", () => {
  const factory = new GroqAdapterFactory();

  const result = factory.bind({
    ...createBinding(),
    target: {
      ...target,
      providerId: "not-groq",
    },
  });

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.error.code, "target-not-supported");
  }
});

test("Groq factory rejects arbitrary upstream endpoints", () => {
  const factory = new GroqAdapterFactory();

  const result = factory.bind({
    ...createBinding(),
    endpoint: {
      id: target.endpointProfileId,
      url: "https://example.invalid/v1/chat/completions",
    },
  });

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.error.code, "endpoint-not-supported");
  }
});

test("Groq adapter performs exactly one official non-streaming request", async () => {
  let callCount = 0;
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;

  const fetchImpl = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ): Promise<Response> => {
    callCount += 1;
    capturedUrl = String(input);
    capturedInit = init;

    return new Response(
      JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "TOKENU GROQ ADAPTER OK",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 11,
          completion_tokens: 7,
          total_tokens: 18,
          prompt_tokens_details: {
            cached_tokens: 3,
          },
          completion_tokens_details: {
            reasoning_tokens: 2,
          },
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }) as typeof fetch;

  const factory = new GroqAdapterFactory({ fetchImpl });
  const bound = factory.bind(createBinding());

  assert.equal(bound.ok, true);
  if (!bound.ok) return;

  const result = await bound.adapter.execute(createRequest());

  assert.equal(callCount, 1);
  assert.equal(capturedUrl, GROQ_OFFICIAL_CHAT_COMPLETIONS_URL);

  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("accept"), "application/json");
  assert.equal(headers.get("authorization"), "Bearer test-groq-secret");

  const sentBody = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;

  assert.equal(sentBody.model, "openai/gpt-oss-20b");
  assert.equal(sentBody.stream, false);
  assert.equal(sentBody["x-provider"], undefined);
  assert.equal(sentBody.stream_options, undefined);

  const messages = sentBody.messages as Array<Record<string, unknown>>;
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.sender, undefined);
  assert.equal(messages[0]?.messageId, undefined);

  assert.equal(result.status, "succeeded");
  assert.equal(result.error, null);
  assert.equal(result.retryability, "not-retryable");

  assert.equal(result.usage.inputTokens, 11);
  assert.equal(result.usage.outputTokens, 7);
  assert.equal(result.usage.reasoningTokens, 2);
  assert.equal(result.usage.cacheReadTokens, 3);
  assert.equal(result.usage.cacheWriteTokens, null);
  assert.equal(result.usage.totalTokens, 18);
});

test("Groq adapter infers zero cached input below the documented Groq cacheable floor", async () => {
  const fetchImpl = (async (): Promise<Response> => {
    return new Response(
      JSON.stringify({
        id: "chatcmpl-cache-floor",
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "ok",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 87,
          completion_tokens: 1,
          total_tokens: 88,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }) as typeof fetch;

  const factory = new GroqAdapterFactory({ fetchImpl });
  const bound = factory.bind(createBinding());

  assert.equal(bound.ok, true);
  if (!bound.ok) return;

  const result = await bound.adapter.execute(createRequest());

  assert.equal(result.status, "succeeded");
  assert.equal(result.usage.inputTokens, 87);
  assert.equal(result.usage.cacheReadTokens, 0);
});

test("Groq adapter keeps cache usage unknown at the cacheable floor when details are omitted", async () => {
  const fetchImpl = (async (): Promise<Response> => {
    return new Response(
      JSON.stringify({
        id: "chatcmpl-cache-floor-boundary",
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "ok",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 128,
          completion_tokens: 1,
          total_tokens: 129,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }) as typeof fetch;

  const factory = new GroqAdapterFactory({ fetchImpl });
  const bound = factory.bind(createBinding());

  assert.equal(bound.ok, true);
  if (!bound.ok) return;

  const result = await bound.adapter.execute(createRequest());

  assert.equal(result.status, "succeeded");
  assert.equal(result.usage.inputTokens, 128);
  assert.equal(result.usage.cacheReadTokens, null);
});

test("Groq adapter keeps cache usage unknown when details exist without cached_tokens", async () => {
  const fetchImpl = (async (): Promise<Response> => {
    return new Response(
      JSON.stringify({
        id: "chatcmpl-cache-detail-missing",
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "ok",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 87,
          completion_tokens: 1,
          total_tokens: 88,
          prompt_tokens_details: {},
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }) as typeof fetch;

  const factory = new GroqAdapterFactory({ fetchImpl });
  const bound = factory.bind(createBinding());

  assert.equal(bound.ok, true);
  if (!bound.ok) return;

  const result = await bound.adapter.execute(createRequest());

  assert.equal(result.status, "succeeded");
  assert.equal(result.usage.inputTokens, 87);
  assert.equal(result.usage.cacheReadTokens, null);
});

test("Groq adapter rejects unsupported parameters before dispatch", async () => {
  let callCount = 0;

  const fetchImpl = (async (): Promise<Response> => {
    callCount += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const factory = new GroqAdapterFactory({ fetchImpl });
  const bound = factory.bind(createBinding());

  assert.equal(bound.ok, true);
  if (!bound.ok) return;

  const result = await bound.adapter.execute(
    createRequest({
      messages: [{ role: "user", content: "hello" }],
      logprobs: true,
    })
  );

  assert.equal(callCount, 0);
  assert.equal(result.status, "failed");
  assert.equal(result.error?.category, "invalid-request");
  assert.equal(result.error?.code, "unsupported-parameter");
  assert.equal(result.retryability, "not-retryable");
});

test("Groq adapter rejects metadata before dispatch", async () => {
  let callCount = 0;

  const fetchImpl = (async (): Promise<Response> => {
    callCount += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const factory = new GroqAdapterFactory({ fetchImpl });
  const bound = factory.bind(createBinding());

  assert.equal(bound.ok, true);
  if (!bound.ok) return;

  const result = await bound.adapter.execute(
    createRequest({
      messages: [{ role: "user", content: "hello" }],
      metadata: { source: "client" },
    })
  );

  assert.equal(callCount, 0);
  assert.equal(result.status, "failed");
  assert.equal(result.error?.code, "unsupported-parameter");
});

test("Groq adapter rejects n other than 1 before dispatch", async () => {
  let callCount = 0;

  const fetchImpl = (async (): Promise<Response> => {
    callCount += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const factory = new GroqAdapterFactory({ fetchImpl });
  const bound = factory.bind(createBinding());

  assert.equal(bound.ok, true);
  if (!bound.ok) return;

  const result = await bound.adapter.execute(
    createRequest({
      messages: [{ role: "user", content: "hello" }],
      n: 2,
    })
  );

  assert.equal(callCount, 0);
  assert.equal(result.status, "failed");
  assert.equal(result.error?.category, "invalid-request");
  assert.equal(result.error?.code, "unsupported-n");
});

test("Groq adapter normalizes 429 and does not retry internally", async () => {
  let callCount = 0;

  const fetchImpl = (async (): Promise<Response> => {
    callCount += 1;

    return new Response(
      JSON.stringify({
        error: {
          message: "Rate limit exceeded",
          type: "rate_limit_error",
          code: "rate_limit",
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }) as typeof fetch;

  const factory = new GroqAdapterFactory({ fetchImpl });
  const bound = factory.bind(createBinding());

  assert.equal(bound.ok, true);
  if (!bound.ok) return;

  const result = await bound.adapter.execute(createRequest());

  assert.equal(callCount, 1);
  assert.equal(result.status, "failed");
  assert.equal(result.error?.category, "rate-limit");
  assert.equal(result.error?.upstreamStatus, 429);
  assert.equal(result.error?.code, "rate_limit");
  assert.equal(result.retryability, "retryable");
});

test("Groq adapter honours cancellation before dispatch", async () => {
  let callCount = 0;

  const fetchImpl = (async (): Promise<Response> => {
    callCount += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const factory = new GroqAdapterFactory({ fetchImpl });
  const bound = factory.bind(createBinding());

  assert.equal(bound.ok, true);
  if (!bound.ok) return;

  const controller = new AbortController();
  controller.abort();

  const result = await bound.adapter.execute(createRequest(), {
    signal: controller.signal,
  });

  assert.equal(callCount, 0);
  assert.equal(result.status, "cancelled");
  assert.equal(result.error?.category, "cancelled");
  assert.equal(result.error?.code, "client-cancelled");
  assert.equal(result.interruption, "before-output");
});

test("Groq adapter rejects internal top-level metadata before dispatch", async () => {
  let callCount = 0;

  const fetchImpl = (async (): Promise<Response> => {
    callCount += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const factory = new GroqAdapterFactory({ fetchImpl });
  const bound = factory.bind(createBinding());

  assert.equal(bound.ok, true);
  if (!bound.ok) return;

  const result = await bound.adapter.execute(
    createRequest({
      messages: [{ role: "user", content: "hello" }],
      "x-provider": "legacy-routing-state",
    })
  );

  assert.equal(callCount, 0);
  assert.equal(result.status, "failed");
  assert.equal(result.error?.category, "invalid-request");
  assert.equal(result.error?.code, "internal-field-not-allowed");
});

test("Groq adapter rejects internal message metadata before dispatch", async () => {
  let callCount = 0;

  const fetchImpl = (async (): Promise<Response> => {
    callCount += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const factory = new GroqAdapterFactory({ fetchImpl });
  const bound = factory.bind(createBinding());

  assert.equal(bound.ok, true);
  if (!bound.ok) return;

  const result = await bound.adapter.execute(
    createRequest({
      messages: [
        {
          role: "user",
          content: "hello",
          sender: "legacy-ui-state",
        },
      ],
    })
  );

  assert.equal(callCount, 0);
  assert.equal(result.status, "failed");
  assert.equal(result.error?.category, "invalid-request");
  assert.equal(result.error?.code, "internal-message-field-not-allowed");
});

test("Groq adapter rejects stream_options in the non-streaming slice", async () => {
  let callCount = 0;

  const fetchImpl = (async (): Promise<Response> => {
    callCount += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const factory = new GroqAdapterFactory({ fetchImpl });
  const bound = factory.bind(createBinding());

  assert.equal(bound.ok, true);
  if (!bound.ok) return;

  const result = await bound.adapter.execute(
    createRequest({
      messages: [{ role: "user", content: "hello" }],
      stream_options: { include_usage: true },
    })
  );

  assert.equal(callCount, 0);
  assert.equal(result.status, "failed");
  assert.equal(result.error?.category, "invalid-request");
  assert.equal(result.error?.code, "stream-options-require-streaming");
});
