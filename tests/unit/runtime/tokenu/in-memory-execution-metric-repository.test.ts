import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryExecutionMetricRepository } from "@/tokenu/runtime/inMemoryExecutionMetricRepository";

test("in memory execution metric repository stores and queries metrics", async () => {
  const repository = new InMemoryExecutionMetricRepository();

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

  await repository.save({
    requestId: "request-2",
    attemptId: "attempt-2",
    sequence: 1,
    providerId: "openai",
    adapterId: "openai-responses",
    modelId: "gpt-test",
    startedAt: "2026-09-08T12:00:00.000Z",
    completedAt: "2026-09-08T12:00:02.000Z",
    durationMs: 2000,
    status: "succeeded",
  });

  const all = await repository.list();

  assert.equal(all.length, 2);

  const groq = await repository.findByProvider("groq");

  assert.equal(groq.length, 1);

  const request = await repository.findByRequestId("request-2");

  assert.equal(request[0]?.modelId, "gpt-test");
});
