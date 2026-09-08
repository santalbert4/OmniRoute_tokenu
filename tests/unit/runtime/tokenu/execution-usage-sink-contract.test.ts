import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionUsageSink } from "@/tokenu/runtime/executionUsageSink";

test("execution usage sink exposes record boundary", async () => {
  const records: unknown[] = [];

  const sink: ExecutionUsageSink = {
    async record(record) {
      records.push(record);
    },
  };

  await sink.record({
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

  assert.equal(records.length, 1);
});
