import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionMetricRepository } from "@/tokenu/runtime/executionMetricRepository";

test("execution metric repository exposes query boundaries", async () => {
  const metrics: unknown[] = [];

  const repository: ExecutionMetricRepository = {
    async save(metric) {
      metrics.push(metric);
    },

    async list() {
      return metrics as never;
    },

    async findByRequestId() {
      return metrics as never;
    },

    async findByProvider() {
      return metrics as never;
    },
  };

  await repository.save({
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

  const result = await repository.findByProvider("groq");

  assert.equal(result.length, 1);
});
