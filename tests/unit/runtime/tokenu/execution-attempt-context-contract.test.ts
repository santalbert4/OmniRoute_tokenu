import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionAttemptContext } from "@/tokenu/contracts/executionAttemptContext";

test("execution attempt context preserves attempt identity", () => {
  const context: ExecutionAttemptContext = {
    requestId: "request-1",
    attemptId: "attempt-1",
    sequence: 1,
    target: {
      providerId: "groq",
      adapterId: "groq-official-openai-v1",
      upstreamModelId: "llama-test",
      endpointProfileId: "groq-default",
    },
    startedAt: "2026-09-08T12:00:00.000Z",
    retryNumber: 0,
  };

  assert.equal(context.requestId, "request-1");
  assert.equal(context.attemptId, "attempt-1");
  assert.equal(context.retryNumber, 0);
});
