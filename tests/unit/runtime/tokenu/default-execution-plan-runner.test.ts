import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";
import { DefaultExecutionPlanRunner } from "@/tokenu/runtime/defaultExecutionPlanRunner";

const target: ExecutionTarget = {
  providerId: "groq",
  modelOfferingId: "groq:test-offering",
  upstreamModelId: "llama-test",
  connectionId: "groq-test-connection",
  credentialMode: "TOKENU_MANAGED",
  technicalProfileId: "groq-test-profile",
  adapterId: "groq-openai",
  endpointProfileId: "default",
  serviceRegion: null,
};

test("runner owns one authoritative attempt identity across context request and result", async () => {
  const events: Array<{ type: string }> = [];

  let factoryAttemptId: string | null = null;
  let dispatchedAttemptId: string | null = null;

  const runner = new DefaultExecutionPlanRunner({
    dispatcher: {
      async execute(request) {
        dispatchedAttemptId = request.attemptId;

        return {
          ok: true,
          result: {
            requestId: request.requestId,
            attemptId: request.attemptId,
            target: request.target,
            status: "succeeded",
          } as never,
        };
      },
    },
    retryPolicy: {
      evaluate() {
        return {
          retry: false,
          reason: "done",
        };
      },
    },
    eventSink: {
      async emit(event) {
        events.push(event);
      },
    },
  });

  const result = await runner.execute(
    {
      requestId: "request-1",
      attempts: [
        {
          sequence: 1,
          target,
        },
      ],
    },
    {
      create(context) {
        factoryAttemptId = context.attemptId;

        return {
          requestId: context.requestId,
          attemptId: context.attemptId,
          target: context.target,
        } as never;
      },
    }
  );

  assert.equal(result.status, "completed");

  assert.equal(factoryAttemptId, "request-1-1");
  assert.equal(dispatchedAttemptId, "request-1-1");

  assert.deepEqual(
    events.map((event) => event.type),
    ["attempt-started", "attempt-completed"]
  );
});

test("runner rejects request attempt identity mismatch before dispatch", async () => {
  let dispatched = false;

  const events: Array<{ type: string }> = [];

  const runner = new DefaultExecutionPlanRunner({
    dispatcher: {
      async execute() {
        dispatched = true;

        throw new Error("must not dispatch");
      },
    },
    retryPolicy: {
      evaluate() {
        return {
          retry: false,
          reason: "unused",
        };
      },
    },
    eventSink: {
      async emit(event) {
        events.push(event);
      },
    },
  });

  await assert.rejects(
    runner.execute(
      {
        requestId: "request-1",
        attempts: [
          {
            sequence: 1,
            target,
          },
        ],
      },
      {
        create(context) {
          return {
            requestId: context.requestId,
            attemptId: "wrong-attempt",
            target: context.target,
          } as never;
        },
      }
    ),
    /request attemptId does not match attempt context/
  );

  assert.equal(dispatched, false);
  assert.deepEqual(events, []);
});

test("runner rejects request target mismatch before dispatch", async () => {
  let dispatched = false;

  const runner = new DefaultExecutionPlanRunner({
    dispatcher: {
      async execute() {
        dispatched = true;

        throw new Error("must not dispatch");
      },
    },
    retryPolicy: {
      evaluate() {
        return {
          retry: false,
          reason: "unused",
        };
      },
    },
    eventSink: {
      async emit() {},
    },
  });

  await assert.rejects(
    runner.execute(
      {
        requestId: "request-1",
        attempts: [
          {
            sequence: 1,
            target,
          },
        ],
      },
      {
        create(context) {
          return {
            requestId: context.requestId,
            attemptId: context.attemptId,
            target: {
              ...context.target,
              upstreamModelId: "wrong-model",
            },
          } as never;
        },
      }
    ),
    /request target does not match attempt context/
  );

  assert.equal(dispatched, false);
});

test("runner rejects result attempt identity mismatch before completed event", async () => {
  const events: Array<{ type: string }> = [];

  const runner = new DefaultExecutionPlanRunner({
    dispatcher: {
      async execute(request) {
        return {
          ok: true,
          result: {
            requestId: request.requestId,
            attemptId: "wrong-attempt",
            target: request.target,
            status: "succeeded",
          } as never,
        };
      },
    },
    retryPolicy: {
      evaluate() {
        return {
          retry: false,
          reason: "unused",
        };
      },
    },
    eventSink: {
      async emit(event) {
        events.push(event);
      },
    },
  });

  await assert.rejects(
    runner.execute(
      {
        requestId: "request-1",
        attempts: [
          {
            sequence: 1,
            target,
          },
        ],
      },
      {
        create(context) {
          return {
            requestId: context.requestId,
            attemptId: context.attemptId,
            target: context.target,
          } as never;
        },
      }
    ),
    /result attemptId does not match attempt context/
  );

  assert.deepEqual(
    events.map((event) => event.type),
    ["attempt-started"]
  );
});

test("runner rejects result target mismatch before completed event", async () => {
  const events: Array<{ type: string }> = [];

  const runner = new DefaultExecutionPlanRunner({
    dispatcher: {
      async execute(request) {
        return {
          ok: true,
          result: {
            requestId: request.requestId,
            attemptId: request.attemptId,
            target: {
              ...request.target,
              connectionId: "wrong-connection",
            },
            status: "succeeded",
          } as never,
        };
      },
    },
    retryPolicy: {
      evaluate() {
        return {
          retry: false,
          reason: "unused",
        };
      },
    },
    eventSink: {
      async emit(event) {
        events.push(event);
      },
    },
  });

  await assert.rejects(
    runner.execute(
      {
        requestId: "request-1",
        attempts: [
          {
            sequence: 1,
            target,
          },
        ],
      },
      {
        create(context) {
          return {
            requestId: context.requestId,
            attemptId: context.attemptId,
            target: context.target,
          } as never;
        },
      }
    ),
    /result target does not match attempt context/
  );

  assert.deepEqual(
    events.map((event) => event.type),
    ["attempt-started"]
  );
});

test("runner rejects blank request identity before creating or dispatching an attempt", async () => {
  let factoryCalled = false;
  let dispatched = false;
  const events: Array<{ type: string }> = [];

  const runner = new DefaultExecutionPlanRunner({
    dispatcher: {
      async execute() {
        dispatched = true;
        throw new Error("must not dispatch");
      },
    },
    retryPolicy: {
      evaluate() {
        return {
          retry: false,
          reason: "unused",
        };
      },
    },
    eventSink: {
      async emit(event) {
        events.push(event);
      },
    },
  });

  await assert.rejects(
    runner.execute(
      {
        requestId: "   ",
        attempts: [
          {
            sequence: 1,
            target,
          },
        ],
      },
      {
        create() {
          factoryCalled = true;
          return {} as never;
        },
      }
    ),
    /requires request identity/
  );

  assert.equal(factoryCalled, false);
  assert.equal(dispatched, false);
  assert.deepEqual(events, []);
});

test("runner rejects empty execution plan before creating an attempt", async () => {
  let factoryCalled = false;
  let dispatched = false;

  const runner = new DefaultExecutionPlanRunner({
    dispatcher: {
      async execute() {
        dispatched = true;
        throw new Error("must not dispatch");
      },
    },
    retryPolicy: {
      evaluate() {
        return {
          retry: false,
          reason: "unused",
        };
      },
    },
    eventSink: {
      async emit() {},
    },
  });

  await assert.rejects(
    runner.execute(
      {
        requestId: "request-1",
        attempts: [],
      },
      {
        create() {
          factoryCalled = true;
          return {} as never;
        },
      }
    ),
    /requires at least one attempt/
  );

  assert.equal(factoryCalled, false);
  assert.equal(dispatched, false);
});

test("runner rejects invalid attempt sequence before execution", async () => {
  let factoryCalled = false;
  let dispatched = false;

  const runner = new DefaultExecutionPlanRunner({
    dispatcher: {
      async execute() {
        dispatched = true;
        throw new Error("must not dispatch");
      },
    },
    retryPolicy: {
      evaluate() {
        return {
          retry: false,
          reason: "unused",
        };
      },
    },
    eventSink: {
      async emit() {},
    },
  });

  await assert.rejects(
    runner.execute(
      {
        requestId: "request-1",
        attempts: [
          {
            sequence: 0,
            target,
          },
        ],
      },
      {
        create() {
          factoryCalled = true;
          return {} as never;
        },
      }
    ),
    /sequence must be a positive safe integer/
  );

  assert.equal(factoryCalled, false);
  assert.equal(dispatched, false);
});

test("runner rejects duplicate attempt sequences before execution", async () => {
  let factoryCalled = false;
  let dispatched = false;
  const events: Array<{ type: string }> = [];

  const runner = new DefaultExecutionPlanRunner({
    dispatcher: {
      async execute() {
        dispatched = true;
        throw new Error("must not dispatch");
      },
    },
    retryPolicy: {
      evaluate() {
        return {
          retry: false,
          reason: "unused",
        };
      },
    },
    eventSink: {
      async emit(event) {
        events.push(event);
      },
    },
  });

  await assert.rejects(
    runner.execute(
      {
        requestId: "request-1",
        attempts: [
          {
            sequence: 1,
            target,
          },
          {
            sequence: 1,
            target: {
              ...target,
              upstreamModelId: "fallback-model",
            },
          },
        ],
      },
      {
        create() {
          factoryCalled = true;
          return {} as never;
        },
      }
    ),
    /attempt sequences must be unique/
  );

  assert.equal(factoryCalled, false);
  assert.equal(dispatched, false);
  assert.deepEqual(events, []);
});
