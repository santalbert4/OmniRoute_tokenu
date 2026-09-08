import assert from "node:assert/strict";
import test from "node:test";

import { DefaultAdapterFactoryRegistry } from "@/tokenu/runtime/defaultAdapterFactoryRegistry";
import { DefaultExecutionDispatcher } from "@/tokenu/runtime/defaultExecutionDispatcher";
import type { ExecutionDependencyResolver } from "@/tokenu/runtime/executionDependencyResolver";
import type { EndpointProfile } from "@/tokenu/runtime/endpointProfileRegistry";
import type { ResolvedCredential } from "@/tokenu/runtime/secretResolver";
import type { TechnicalModelProfile } from "@/tokenu/contracts/model";

import { GROQ_OFFICIAL_CHAT_COMPLETIONS_URL } from "@/tokenu/adapters/groq/groqAdapterFactory";

const target = {
  providerId: "groq",
  modelOfferingId: "groq-gpt-oss-20b",
  upstreamModelId: "openai/gpt-oss-20b",
  connectionId: "groq-test",
  credentialMode: "TOKENU_MANAGED",
  technicalProfileId: "groq-profile",
  adapterId: "groq-official-openai-v1",
  endpointProfileId: "groq-endpoint",
  serviceRegion: null,
} as const;

const technicalModelProfile: TechnicalModelProfile = {
  id: "groq-profile",
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

function createResolver(): ExecutionDependencyResolver {
  return {
    async resolveEndpoint(): Promise<EndpointProfile> {
      return {
        id: target.endpointProfileId,
        url: GROQ_OFFICIAL_CHAT_COMPLETIONS_URL,
      };
    },

    async resolveCredential(): Promise<ResolvedCredential> {
      return {
        kind: "api-key",
        value: "test-secret",
      };
    },

    async resolveTechnicalModelProfile(): Promise<TechnicalModelProfile> {
      return technicalModelProfile;
    },
  };
}

function createRequest() {
  return {
    requestId: "req-dispatch-1",
    attemptId: "attempt-dispatch-1",
    target,
    continuityScope: null,
    payload: {
      messages: [
        {
          role: "user",
          content: "hello",
        },
      ],
    },
    requestProtocol: "openai",
    clientResponseProtocol: "openai",
    timeoutPolicy: {
      attemptTimeoutMs: 1000,
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
  } as const;
}

test("dispatcher executes approved Groq adapter path", async () => {
  const dispatcher = new DefaultExecutionDispatcher({
    adapterRegistry: new DefaultAdapterFactoryRegistry({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "TOKENU DISPATCH OK",
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
        ) as Response,
    }),
    dependencyResolver: createResolver(),
  });

  const result = await dispatcher.execute(createRequest());

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.result.status, "succeeded");
    assert.equal(result.result.usage.totalTokens, 8);
  }
});
