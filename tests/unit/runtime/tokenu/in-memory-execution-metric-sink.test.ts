import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryExecutionMetricSink } from "@/tokenu/runtime/inMemoryExecutionMetricSink";

test("in memory metric sink stores execution metrics", async () => {
  const sink = new InMemoryExecutionMetricSink();

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

  assert.equal(sink.getMetrics().length, 1);

  assert.equal(sink.getMetrics()[0]?.providerId, "groq");

  assert.equal(sink.getMetrics()[0]?.durationMs, 1000);
});
