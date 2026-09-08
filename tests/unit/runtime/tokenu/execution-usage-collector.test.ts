import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionUsageCollector } from "@/tokenu/runtime/executionUsageCollector";
import type { ExecutionUsageSink } from "@/tokenu/runtime/executionUsageSink";

test("execution usage collector records completed attempt usage", async () => {
  const records: unknown[] = [];

  const sink: ExecutionUsageSink = {
    async record(record) {
      records.push(record);
    },
  };

  const collector = new ExecutionUsageCollector(sink);

  await collector.consume({
    type: "attempt-completed",
    context: {
      requestId: "request-1",
      attemptId: "attempt-1",
      sequence: 1,
      target: {
        providerId: "groq",
        modelOfferingId: "groq:test-offering",
        upstreamModelId: "llama-test",
        connectionId: "groq-test-connection",
        credentialMode: "TOKENU_MANAGED",
        technicalProfileId: "groq-test-profile",
        adapterId: "groq-openai",
        endpointProfileId: "groq-test-endpoint",
        serviceRegion: null,
      },
      startedAt: "2026-09-08T12:00:00.000Z",
      retryNumber: 0,
    },
    result: {
      requestId: "request-1",
      attemptId: "attempt-1",
      target: {
        providerId: "groq",
        modelOfferingId: "groq:test-offering",
        upstreamModelId: "llama-test",
        connectionId: "groq-test-connection",
        credentialMode: "TOKENU_MANAGED",
        technicalProfileId: "groq-test-profile",
        adapterId: "groq-openai",
        endpointProfileId: "groq-test-endpoint",
        serviceRegion: null,
      },
      output: null,
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
        totalTokens: 150,
      },
      timing: {
        startedAt: "2026-09-08T12:00:00.000Z",
        completedAt: "2026-09-08T12:00:01.000Z",
        durationMs: 1000,
        timeToFirstByteMs: null,
      },
      status: "succeeded",
      error: null,
      retryability: "not-retryable",
      interruption: "none",
    },
  });

  assert.equal(records.length, 1);

  const record = records[0] as {
    usage: {
      totalTokens: number;
    };
  };

  assert.equal(record.usage.totalTokens, 150);
});
