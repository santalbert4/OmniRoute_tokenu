import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryExecutionUsageRepository } from "@/tokenu/runtime/inMemoryExecutionUsageRepository";

test("in memory execution usage repository stores and queries usage records", async () => {
  const repository = new InMemoryExecutionUsageRepository();

  await repository.save({
    requestId: "request-1",
    attemptId: "attempt-1",
    providerId: "groq",
    modelId: "llama-test",
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      reasoningTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: 150,
    },
    recordedAt: "2026-09-08T12:00:01.000Z",
  });

  await repository.save({
    requestId: "request-2",
    attemptId: "attempt-2",
    providerId: "openai",
    modelId: "gpt-test",
    usage: {
      inputTokens: 200,
      outputTokens: 100,
      reasoningTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: 300,
    },
    recordedAt: "2026-09-08T12:00:02.000Z",
  });

  const all = await repository.list();

  assert.equal(all.length, 2);

  const groq = await repository.findByProvider("groq");

  assert.equal(groq.length, 1);

  const request = await repository.findByRequestId("request-2");

  assert.equal(request[0]?.usage.totalTokens, 300);
});
