import assert from "node:assert/strict";
import test from "node:test";

import type { UsageProjectionAttempt } from "@/tokenu/contracts/usageProjectionAttempt";
import { UsageProjectionService } from "@/tokenu/runtime/usageProjectionService";

const usage = {
  inputTokens: 1000,
  outputTokens: 500,
  reasoningTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  totalTokens: 1500,
} as const;

test("usage projection service derives UTC period and historical estimated cost", async () => {
  let calculatedRecord: unknown = null;
  let projectedAttempt: UsageProjectionAttempt | null = null;

  const service = new UsageProjectionService(
    {
      async calculate(record) {
        calculatedRecord = record;

        return {
          providerId: record.providerId,
          modelId: record.modelId,
          currency: "USD",
          inputCost: 0.001,
          outputCost: 0.001,
          totalCost: 0.002,
        };
      },
    },
    {
      async projectAttempt(attempt) {
        projectedAttempt = attempt;
        return true;
      },
    }
  );

  const recorded = await service.recordExecution({
    workspaceId: "workspace-a",
    requestId: "request-1",
    attemptId: "attempt-1",
    providerId: "groq",
    modelId: "llama-test",
    usage,
    recordedAt: "2026-09-30T23:30:00-02:00",
  });

  assert.equal(recorded, true);

  assert.deepEqual(calculatedRecord, {
    requestId: "request-1",
    attemptId: "attempt-1",
    providerId: "groq",
    modelId: "llama-test",
    usage,
    recordedAt: "2026-10-01T01:30:00.000Z",
  });

  assert.deepEqual(projectedAttempt, {
    workspaceId: "workspace-a",
    requestId: "request-1",
    attemptId: "attempt-1",
    period: "2026-10",
    providerId: "groq",
    modelId: "llama-test",
    inputTokens: 1000,
    outputTokens: 500,
    estimatedCost: 0.002,
    recordedAt: "2026-10-01T01:30:00.000Z",
  });
});

test("usage projection service records token usage with zero estimate when pricing is unavailable", async () => {
  const projectedAttempts: UsageProjectionAttempt[] = [];

  const service = new UsageProjectionService(
    {
      async calculate() {
        return null;
      },
    },
    {
      async projectAttempt(attempt) {
        projectedAttempts.push(attempt);
        return true;
      },
    }
  );

  await service.recordExecution({
    workspaceId: "workspace-a",
    requestId: "request-1",
    attemptId: "attempt-1",
    providerId: "groq",
    modelId: "unpriced-model",
    usage,
    recordedAt: "2026-09-09T12:00:00.000Z",
  });

  assert.equal(projectedAttempts.length, 1);
  assert.equal(projectedAttempts[0]?.estimatedCost, 0);
  assert.equal(projectedAttempts[0]?.period, "2026-09");
});

test("usage projection service rejects invalid execution timestamp before projection", async () => {
  let calculatorCalled = false;
  let repositoryCalled = false;

  const service = new UsageProjectionService(
    {
      async calculate() {
        calculatorCalled = true;
        return null;
      },
    },
    {
      async projectAttempt() {
        repositoryCalled = true;
        return true;
      },
    }
  );

  await assert.rejects(
    service.recordExecution({
      workspaceId: "workspace-a",
      requestId: "request-1",
      attemptId: "attempt-1",
      providerId: "groq",
      modelId: "llama-test",
      usage,
      recordedAt: "not-a-timestamp",
    }),
    /valid recorded timestamp/
  );

  assert.equal(calculatorCalled, false);
  assert.equal(repositoryCalled, false);
});
