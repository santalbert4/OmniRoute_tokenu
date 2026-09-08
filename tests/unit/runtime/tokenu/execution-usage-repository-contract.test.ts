import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionUsageRepository } from "@/tokenu/runtime/executionUsageRepository";

test("execution usage repository exposes query boundaries", async () => {
  const records: unknown[] = [];

  const repository: ExecutionUsageRepository = {
    async save(record) {
      records.push(record);
    },

    async list() {
      return records as never;
    },

    async findByRequestId() {
      return records as never;
    },

    async findByProvider() {
      return records as never;
    },
  };

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

  const result = await repository.findByProvider("groq");

  assert.equal(result.length, 1);
});
