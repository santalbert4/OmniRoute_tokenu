import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionMetricRepositorySink } from "@/tokenu/runtime/executionMetricRepositorySink";
import { InMemoryExecutionMetricRepository } from "@/tokenu/runtime/inMemoryExecutionMetricRepository";

test("repository sink persists metrics through repository", async () => {
  const repository = new InMemoryExecutionMetricRepository();

  const sink = new ExecutionMetricRepositorySink(repository);

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

  const metrics = await repository.list();

  assert.equal(metrics.length, 1);
  assert.equal(metrics[0]?.providerId, "groq");
});
