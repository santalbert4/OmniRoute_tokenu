import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionUsageAnalyticsService } from "@/tokenu/runtime/executionUsageAnalyticsService";
import type { ExecutionUsageRepository } from "@/tokenu/runtime/executionUsageRepository";

test("execution usage analytics calculates rankings", async () => {
  const repository: ExecutionUsageRepository = {
    async save() {},

    async list() {
      return [
        {
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
        },
        {
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
        },
      ];
    },

    async findByRequestId() {
      return [];
    },

    async findByProvider() {
      return [];
    },
  };

  const service = new ExecutionUsageAnalyticsService(repository);

  const analytics = await service.analyze();

  assert.equal(analytics.totalRequests, 2);

  assert.equal(analytics.totalTokens, 450);

  assert.equal(analytics.providerRanking[0]?.providerId, "openai");
});
