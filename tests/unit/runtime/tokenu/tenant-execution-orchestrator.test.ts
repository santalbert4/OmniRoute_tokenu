import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionPlanRequestFactory } from "@/tokenu/runtime/executionPlanRunner";
import type { ExecutionPlanRunnerFactory } from "@/tokenu/runtime/executionPlanRunnerFactory";
import { TenantExecutionOrchestrator } from "@/tokenu/runtime/tenantExecutionOrchestrator";

const commercialPlan = {
  id: "starter",
  tier: "starter",
  monthlyCostLimit: 25,
  monthlyRequestLimit: 100,
  currency: "USD",
} as const;

const allowedQuota = {
  allowed: true,
  reason: null,
  remainingCost: 20,
  remainingRequests: 7,
} as const;

const executionPlan = {
  requestId: "request-1",
  attempts: [
    {
      sequence: 1,
      target: {
        providerId: "groq",
        modelOfferingId: "groq:test",
        upstreamModelId: "llama-test",
        connectionId: "groq-connection",
        credentialMode: "TOKENU_MANAGED",
        technicalProfileId: "groq-profile",
        adapterId: "groq-openai",
        endpointProfileId: "groq-default",
        serviceRegion: null,
      },
    },
  ],
} as const;

const requestFactory: ExecutionPlanRequestFactory = {
  create(context) {
    return {
      requestId: context.requestId,
      attemptId: context.attemptId,
      target: context.target,
    } as never;
  },
};

test("orchestrator stops when workspace plan is unavailable", async () => {
  let admissionCalled = false;
  let sinkCreated = false;
  let runnerCreated = false;

  const orchestrator = new TenantExecutionOrchestrator(
    {
      async evaluate() {
        return {
          status: "plan-unavailable",
          reason: "workspace plan not assigned",
        };
      },
    },
    {
      async admit() {
        admissionCalled = true;
        throw new Error("must not admit");
      },
    },
    {
      create() {
        sinkCreated = true;
        throw new Error("must not create sink");
      },
    },
    {
      create() {
        runnerCreated = true;
        throw new Error("must not create runner");
      },
    }
  );

  const result = await orchestrator.execute({
    workspaceId: "workspace-a",
    period: "2026-09",
    executionPlan,
    requestFactory,
  });

  assert.deepEqual(result, {
    status: "plan-unavailable",
    reason: "workspace plan not assigned",
  });

  assert.equal(admissionCalled, false);
  assert.equal(sinkCreated, false);
  assert.equal(runnerCreated, false);
});

test("orchestrator stops when read-only preflight denies quota", async () => {
  let admissionCalled = false;
  let sinkCreated = false;

  const deniedQuota = {
    allowed: false,
    reason: "monthly request quota exceeded",
    remainingCost: 20,
    remainingRequests: 0,
  };

  const orchestrator = new TenantExecutionOrchestrator(
    {
      async evaluate() {
        return {
          status: "quota-denied",
          plan: commercialPlan,
          quota: deniedQuota,
        };
      },
    },
    {
      async admit() {
        admissionCalled = true;
        throw new Error("must not admit");
      },
    },
    {
      create() {
        sinkCreated = true;
        throw new Error("must not create sink");
      },
    },
    {
      create() {
        throw new Error("must not create runner");
      },
    }
  );

  const result = await orchestrator.execute({
    workspaceId: "workspace-a",
    period: "2026-09",
    executionPlan,
    requestFactory,
  });

  assert.deepEqual(result, {
    status: "quota-denied",
    plan: commercialPlan,
    quota: deniedQuota,
  });

  assert.equal(admissionCalled, false);
  assert.equal(sinkCreated, false);
});

test("orchestrator uses only the resolved commercial plan limit for atomic admission", async () => {
  let admittedLimit: number | null = null;
  let sinkCreated = false;
  let runnerCreated = false;

  const orchestrator = new TenantExecutionOrchestrator(
    {
      async evaluate() {
        return {
          status: "allowed",
          plan: commercialPlan,
          quota: allowedQuota,
        };
      },
    },
    {
      async admit(_workspaceId, _period, monthlyRequestLimit) {
        admittedLimit = monthlyRequestLimit;

        return {
          admitted: false,
          remainingRequests: 0,
          reason: "monthly request quota exceeded",
        };
      },
    },
    {
      create() {
        sinkCreated = true;
        throw new Error("must not create sink");
      },
    },
    {
      create() {
        runnerCreated = true;
        throw new Error("must not create runner");
      },
    }
  );

  const result = await orchestrator.execute({
    workspaceId: "workspace-a",
    period: "2026-09",
    executionPlan,
    requestFactory,
  });

  assert.equal(admittedLimit, 100);

  assert.deepEqual(result, {
    status: "admission-denied",
    plan: commercialPlan,
    admission: {
      admitted: false,
      remainingRequests: 0,
      reason: "monthly request quota exceeded",
    },
  });

  assert.equal(sinkCreated, false);
  assert.equal(runnerCreated, false);
});

test("orchestrator admits once then executes through the tenant event pipeline", async () => {
  const order: string[] = [];

  const eventSink = {
    async emit() {},
  };

  let runnerEventSink: unknown = null;
  let runnerPlan: unknown = null;
  let runnerRequestFactory: unknown = null;

  const runnerFactory: ExecutionPlanRunnerFactory = {
    create(options) {
      order.push("runner-create");

      runnerEventSink = options.eventSink;

      return {
        async execute(plan, factory) {
          order.push("runner-execute");

          runnerPlan = plan;
          runnerRequestFactory = factory;

          return {
            status: "dispatch-failed",
            error: {
              code: "adapter-not-found",
              message: "adapter unavailable",
            },
          };
        },
      };
    },
  };

  const orchestrator = new TenantExecutionOrchestrator(
    {
      async evaluate(workspaceId, period) {
        order.push("preflight");

        assert.equal(workspaceId, "workspace-a");
        assert.equal(period, "2026-09");

        return {
          status: "allowed",
          plan: commercialPlan,
          quota: allowedQuota,
        };
      },
    },
    {
      async admit(workspaceId, period, monthlyRequestLimit) {
        order.push("admission");

        assert.equal(workspaceId, "workspace-a");
        assert.equal(period, "2026-09");
        assert.equal(monthlyRequestLimit, commercialPlan.monthlyRequestLimit);

        return {
          admitted: true,
          requestCount: 94,
          remainingRequests: 6,
        };
      },
    },
    {
      create(workspaceId) {
        order.push("event-sink");

        assert.equal(workspaceId, "workspace-a");

        return eventSink;
      },
    },
    runnerFactory
  );

  const result = await orchestrator.execute({
    workspaceId: "workspace-a",
    period: "2026-09",
    executionPlan,
    requestFactory,
  });

  assert.deepEqual(order, [
    "preflight",
    "admission",
    "event-sink",
    "runner-create",
    "runner-execute",
  ]);

  assert.equal(runnerEventSink, eventSink);
  assert.equal(runnerPlan, executionPlan);
  assert.equal(runnerRequestFactory, requestFactory);

  assert.deepEqual(result, {
    status: "executed",
    plan: commercialPlan,
    admission: {
      admitted: true,
      requestCount: 94,
      remainingRequests: 6,
    },
    execution: {
      status: "dispatch-failed",
      error: {
        code: "adapter-not-found",
        message: "adapter unavailable",
      },
    },
  });
});

test("orchestrator propagates critical runner failures after admission", async () => {
  const orchestrator = new TenantExecutionOrchestrator(
    {
      async evaluate() {
        return {
          status: "allowed",
          plan: commercialPlan,
          quota: allowedQuota,
        };
      },
    },
    {
      async admit() {
        return {
          admitted: true,
          requestCount: 1,
          remainingRequests: 99,
        };
      },
    },
    {
      create() {
        return {
          async emit() {},
        };
      },
    },
    {
      create() {
        return {
          async execute() {
            throw new Error("authoritative billing unavailable");
          },
        };
      },
    }
  );

  await assert.rejects(
    orchestrator.execute({
      workspaceId: "workspace-a",
      period: "2026-09",
      executionPlan,
      requestFactory,
    }),
    /authoritative billing unavailable/
  );
});
