import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionMetric } from "@/tokenu/contracts/executionMetric";

test("execution metric preserves runtime measurement fields", () => {
  const metric: ExecutionMetric = {
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
  };

  assert.equal(metric.providerId, "groq");
  assert.equal(metric.durationMs, 1000);
});
