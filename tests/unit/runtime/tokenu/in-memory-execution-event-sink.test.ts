import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryExecutionEventSink } from "@/tokenu/runtime/inMemoryExecutionEventSink";

test("in memory sink stores execution events", async () => {
  const sink = new InMemoryExecutionEventSink();

  await sink.emit({
    type: "attempt-started",
    context: {
      requestId: "request-1",
      attemptId: "attempt-1",
      sequence: 1,
      target: {
        providerId: "groq",
        modelOfferingId: "groq:test-offering",
        upstreamModelId: "test-model",
        connectionId: "groq-test-connection",
        credentialMode: "TOKENU_MANAGED",
        technicalProfileId: "groq-test-profile",
        adapterId: "groq-openai",
        endpointProfileId: "default",
        serviceRegion: null,
      },
      startedAt: "2026-09-08T12:00:00.000Z",
      retryNumber: 0,
    },
  });

  assert.equal(sink.getEvents().length, 1);

  assert.equal(sink.getEvents()[0]?.type, "attempt-started");
});
