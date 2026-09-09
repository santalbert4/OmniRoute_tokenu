import assert from "node:assert/strict";
import test from "node:test";

import type { TechnicalModelProfile } from "@/tokenu/contracts/model";
import { DefaultExecutionDependencyResolver } from "@/tokenu/runtime/defaultExecutionDependencyResolver";
import { DefaultExecutionPlanRunnerFactory } from "@/tokenu/runtime/defaultExecutionPlanRunnerFactory";
import { DefaultRetryPolicy } from "@/tokenu/runtime/defaultRetryPolicy";
import { NullSecretResolver } from "@/tokenu/runtime/nullSecretResolver";
import { StaticEndpointProfileRegistry } from "@/tokenu/runtime/staticEndpointProfileRegistry";
import { StaticTechnicalModelProfileRegistry } from "@/tokenu/runtime/staticTechnicalModelProfileRegistry";

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

test("static endpoint registry resolves only explicitly approved profiles", () => {
  const registry = new StaticEndpointProfileRegistry([
    {
      id: "groq-official-chat-completions",
      url: "https://api.groq.com/openai/v1/chat/completions",
    },
  ]);

  assert.deepEqual(registry.resolve("groq-official-chat-completions"), {
    id: "groq-official-chat-completions",
    url: "https://api.groq.com/openai/v1/chat/completions",
  });

  assert.equal(registry.resolve("unknown"), null);
});

test("static endpoint registry rejects duplicate profile identity", () => {
  assert.throws(
    () =>
      new StaticEndpointProfileRegistry([
        {
          id: "same",
          url: "https://example.test/a",
        },
        {
          id: "same",
          url: "https://example.test/b",
        },
      ]),
    /already registered/
  );
});

test("static technical profile registry resolves exact reviewed profile only", () => {
  const registry = new StaticTechnicalModelProfileRegistry([technicalProfile]);

  assert.equal(registry.resolve("groq-gpt-oss-20b-profile"), technicalProfile);

  assert.equal(registry.resolve("unknown"), null);
});

test("default execution dependency resolver performs exact target lookup only", async () => {
  const resolver = new DefaultExecutionDependencyResolver({
    endpointProfileRegistry: new StaticEndpointProfileRegistry([
      {
        id: target.endpointProfileId,
        url: "https://api.groq.com/openai/v1/chat/completions",
      },
    ]),
    secretResolver: {
      async resolve(connectionId) {
        if (connectionId !== "groq-managed") {
          return null;
        }

        return {
          kind: "api-key",
          value: "test-secret",
        };
      },
    },
    technicalModelProfileRegistry: new StaticTechnicalModelProfileRegistry([technicalProfile]),
  });

  assert.deepEqual(await resolver.resolveEndpoint(target), {
    id: target.endpointProfileId,
    url: "https://api.groq.com/openai/v1/chat/completions",
  });

  assert.deepEqual(await resolver.resolveCredential(target), {
    kind: "api-key",
    value: "test-secret",
  });

  assert.equal(await resolver.resolveTechnicalModelProfile(target), technicalProfile);
});

test("null secret resolver always fails closed", async () => {
  const resolver = new NullSecretResolver();

  assert.equal(await resolver.resolve("groq-managed"), null);
  assert.equal(await resolver.resolve("anything-else"), null);
});

test("default runner factory binds dispatcher retry policy and tenant event sink", async () => {
  let dispatched = false;
  const emitted: string[] = [];

  const factory = new DefaultExecutionPlanRunnerFactory({
    dispatcher: {
      async execute(request) {
        dispatched = true;

        return {
          ok: true,
          result: {
            requestId: request.requestId,
            attemptId: request.attemptId,
            target: request.target,
            output: null,
            usage: {
              inputTokens: 1,
              outputTokens: 1,
              reasoningTokens: null,
              cacheReadTokens: null,
              cacheWriteTokens: null,
              totalTokens: 2,
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
        };
      },
    },
    retryPolicy: new DefaultRetryPolicy(),
  });

  const runner = factory.create({
    eventSink: {
      async emit(event) {
        emitted.push(event.type);
      },
    },
  });

  const execution = await runner.execute(
    {
      requestId: "request-1",
      attempts: [
        {
          sequence: 1,
          target,
        },
      ],
    },
    {
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
                content: "hello",
              },
            ],
          },
          requestProtocol: "openai",
          clientResponseProtocol: "openai",
          timeoutPolicy: {
            attemptTimeoutMs: 1000,
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
    }
  );

  assert.equal(dispatched, true);
  assert.equal(execution.status, "completed");
  assert.deepEqual(emitted, ["attempt-started", "attempt-completed"]);
});
