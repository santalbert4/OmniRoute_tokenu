import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionUsageAggregator } from "@/tokenu/runtime/executionUsageAggregator";

test("execution usage aggregator summarizes token usage", () => {
  const aggregator = new ExecutionUsageAggregator();

  const summary = aggregator.aggregate([
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
  ]);

  assert.equal(summary.requestCount, 2);
  assert.equal(summary.totalTokens, 450);
  assert.equal(summary.byProvider.groq, 150);
  assert.equal(summary.byProvider.openai, 300);
});
