import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionMetricSink } from "@/tokenu/runtime/executionMetricSink";

test("execution metric sink exposes record boundary", async () => {
  const metrics: unknown[] = [];

  const sink: ExecutionMetricSink = {
    async record(metric) {
      metrics.push(metric);
    },
  };

  await sink.record({
    requestId: "request-1",
    attemptId: "attempt-1",
    sequence: 1,
    providerId: "groq",
    adapterId: "groq-openai",
    modelId: "llama-test",
    startedAt: "2026-09-08T12:00:00.000Z",
    completedAt: "2026-09-08T12:00:01.000Z",
    durationMs: 1000,
    status: "succeeded",
  });

  assert.equal(metrics.length, 1);
});
