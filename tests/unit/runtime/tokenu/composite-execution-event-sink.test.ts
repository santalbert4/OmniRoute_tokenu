import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionEvent } from "@/tokenu/contracts/executionEvent";
import { CompositeExecutionEventSink } from "@/tokenu/runtime/compositeExecutionEventSink";

const event = {
  type: "attempt-started",
  context: {
    requestId: "request-1",
    attemptId: "attempt-1",
    sequence: 1,
    target: {
      providerId: "groq",
      modelOfferingId: "groq:test-offering",
      upstreamModelId: "llama-test",
      connectionId: "groq-test-connection",
      credentialMode: "TOKENU_MANAGED",
      technicalProfileId: "groq-test-profile",
      adapterId: "groq-openai",
      endpointProfileId: "default",
      serviceRegion: null,
    },
    startedAt: "2026-09-09T10:00:00.000Z",
    retryNumber: 0,
  },
} as ExecutionEvent;

test("composite execution event sink fans events out to every consumer", async () => {
  const received: string[] = [];

  const sink = new CompositeExecutionEventSink([
    {
      async consume() {
        received.push("first");
      },
    },
    {
      async consume() {
        received.push("second");
      },
    },
  ]);

  await sink.emit(event);

  assert.deepEqual(received.sort(), ["first", "second"]);
});

test("composite execution event sink invokes all consumers even when one fails", async () => {
  let secondCalled = false;

  const sink = new CompositeExecutionEventSink([
    {
      async consume() {
        throw new Error("consumer failed");
      },
    },
    {
      async consume() {
        secondCalled = true;
      },
    },
  ]);

  await assert.rejects(sink.emit(event), /consumer failed/);

  assert.equal(secondCalled, true);
});
