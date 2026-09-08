import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionUsageService } from "@/tokenu/runtime/executionUsageService";
import type { ExecutionUsageRepository } from "@/tokenu/runtime/executionUsageRepository";

test("execution usage service delegates queries to repository", async () => {
  const repository: ExecutionUsageRepository = {
    async save() {},

    async list() {
      return [];
    },

    async findByRequestId(requestId) {
      return [
        {
          requestId,
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
        },
      ];
    },

    async findByProvider() {
      return [];
    },
  };

  const service = new ExecutionUsageService(repository);

  const records = await service.findByRequestId("request-1");

  assert.equal(records.length, 1);
  assert.equal(records[0]?.requestId, "request-1");
});
