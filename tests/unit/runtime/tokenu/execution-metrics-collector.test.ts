import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionMetricsCollector } from "@/tokenu/runtime/executionMetricsCollector";

test("collector converts execution events into metrics", async () => {
  const metrics: unknown[] = [];

  const collector = new ExecutionMetricsCollector({
    async record(metric) {
      metrics.push(metric);
    },
  });

  await collector.consume({
    type: "attempt-started",
    context: {
      requestId: "request-1",
      attemptId: "attempt-1",
      sequence: 1,
      target: {
        providerId: "groq",
        adapterId: "groq-openai",
        upstreamModelId: "llama-test",
        endpointProfileId: "default",
      },
      startedAt: "2026-09-08T12:00:00.000Z",
      retryNumber: 0,
    },
  });

  await collector.consume({
    type: "attempt-completed",
    context: {
      requestId: "request-1",
      attemptId: "attempt-1",
      sequence: 1,
      target: {
        providerId: "groq",
        adapterId: "groq-openai",
        upstreamModelId: "llama-test",
        endpointProfileId: "default",
      },
      startedAt: "2026-09-08T12:00:00.000Z",
      retryNumber: 0,
    },
    result: {
      status: "succeeded",
    } as never,
  });

  assert.equal(metrics.length, 1);
});
