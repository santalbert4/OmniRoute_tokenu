import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionEvent } from "@/tokenu/contracts/executionEvent";

test("execution event exposes attempt lifecycle events", () => {
  const event: ExecutionEvent = {
    type: "attempt-started",
    context: {
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
    },
  };

  assert.equal(event.type, "attempt-started");
  assert.equal(event.context.attemptId, "attempt-1");
});
