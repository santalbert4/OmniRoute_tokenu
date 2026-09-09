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

test("composite execution event sink delivers events to critical and best-effort consumers", async () => {
  const received: string[] = [];

  const sink = new CompositeExecutionEventSink({
    criticalConsumers: [
      {
        async consume() {
          received.push("critical");
        },
      },
    ],
    bestEffortConsumers: [
      {
        async consume() {
          received.push("best-effort");
        },
      },
    ],
  });

  await sink.emit(event);

  assert.deepEqual(received.sort(), ["best-effort", "critical"]);
});

test("critical execution event consumer failure rejects delivery", async () => {
  let bestEffortCalled = false;

  const sink = new CompositeExecutionEventSink({
    criticalConsumers: [
      {
        async consume() {
          throw new Error("critical billing failed");
        },
      },
    ],
    bestEffortConsumers: [
      {
        async consume() {
          bestEffortCalled = true;
        },
      },
    ],
  });

  await assert.rejects(sink.emit(event), /critical billing failed/);

  assert.equal(bestEffortCalled, true);
});

test("best-effort execution event failure does not reject delivery", async () => {
  const failures: unknown[] = [];

  const sink = new CompositeExecutionEventSink({
    criticalConsumers: [
      {
        async consume() {},
      },
    ],
    bestEffortConsumers: [
      {
        async consume() {
          throw new Error("metrics unavailable");
        },
      },
    ],
    onBestEffortError(failure) {
      failures.push(failure);
    },
  });

  await assert.doesNotReject(sink.emit(event));

  assert.equal(failures.length, 1);

  const failure = failures[0] as {
    consumerIndex: number;
    error: Error;
  };

  assert.equal(failure.consumerIndex, 0);

  assert.match(failure.error.message, /metrics unavailable/);
});

test("all best-effort consumers run even when one fails", async () => {
  let secondCalled = false;

  const sink = new CompositeExecutionEventSink({
    bestEffortConsumers: [
      {
        async consume() {
          throw new Error("first failed");
        },
      },
      {
        async consume() {
          secondCalled = true;
        },
      },
    ],
    onBestEffortError() {},
  });

  await assert.doesNotReject(sink.emit(event));

  assert.equal(secondCalled, true);
});

test("best-effort error observer cannot abort execution delivery", async () => {
  const sink = new CompositeExecutionEventSink({
    bestEffortConsumers: [
      {
        async consume() {
          throw new Error("telemetry failed");
        },
      },
    ],
    onBestEffortError() {
      throw new Error("logger failed");
    },
  });

  await assert.doesNotReject(sink.emit(event));
});
