import assert from "node:assert/strict";
import test from "node:test";

import { CostLedgerService } from "@/tokenu/runtime/costLedgerService";
import { ExecutionCostCalculator } from "@/tokenu/runtime/executionCostCalculator";
import { InMemoryCostLedgerRepository } from "@/tokenu/runtime/inMemoryCostLedgerRepository";
import { InMemoryProviderPricingRepository } from "@/tokenu/runtime/inMemoryProviderPricingRepository";
import { TenantExecutionEventSinkFactory } from "@/tokenu/runtime/tenantExecutionEventSinkFactory";
import type { UsageProjectionService } from "@/tokenu/runtime/usageProjectionService";

type UsageProjectionRecord = Parameters<UsageProjectionService["recordExecution"]>[0];

function completedEvent() {
  return {
    type: "attempt-completed" as const,
    context: {
      requestId: "request-1",
      attemptId: "attempt-1",
      sequence: 1,
      target: {
        providerId: "groq",
        modelOfferingId: "groq:test-offering",
        upstreamModelId: "llama-test",
        connectionId: "groq-test-connection",
        credentialMode: "TOKENU_MANAGED" as const,
        technicalProfileId: "groq-test-profile",
        adapterId: "groq-openai",
        endpointProfileId: "default",
        serviceRegion: null,
      },
      startedAt: "2026-09-09T10:00:00.000Z",
      retryNumber: 0,
    },
    result: {
      requestId: "request-1",
      attemptId: "attempt-1",
      target: {
        providerId: "groq",
        modelOfferingId: "groq:test-offering",
        upstreamModelId: "llama-test",
        connectionId: "groq-test-connection",
        credentialMode: "TOKENU_MANAGED" as const,
        technicalProfileId: "groq-test-profile",
        adapterId: "groq-openai",
        endpointProfileId: "default",
        serviceRegion: null,
      },
      output: null,
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        reasoningTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
        totalTokens: 1500,
      },
      timing: {
        startedAt: "2026-09-09T10:00:00.000Z",
        completedAt: "2026-09-09T10:00:01.000Z",
        durationMs: 1000,
        timeToFirstByteMs: null,
      },
      status: "succeeded" as const,
      error: null,
      retryability: "not-retryable" as const,
      interruption: "none" as const,
    },
  };
}

async function createFixture() {
  const pricing = new InMemoryProviderPricingRepository();

  await pricing.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokenPricePerMillion: 0.2,
    outputTokenPricePerMillion: 0.8,
    effectiveFrom: "2026-09-01T00:00:00.000Z",
  });

  const ledger = new InMemoryCostLedgerRepository();

  const projected: UsageProjectionRecord[] = [];

  const factory = new TenantExecutionEventSinkFactory(
    new CostLedgerService(new ExecutionCostCalculator(pricing), ledger),
    {
      async recordExecution(record) {
        projected.push(record);
        return true;
      },
    }
  );

  return {
    ledger,
    projected,
    factory,
  };
}

test("tenant execution event sink factory records critical billing and automatic usage projection", async () => {
  const { ledger, projected, factory } = await createFixture();

  const sink = factory.create("workspace-a");

  await sink.emit(completedEvent());

  const entries = await ledger.list("workspace-a");

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.attemptId, "attempt-1");
  assert.equal(entries[0]?.providerId, "groq");

  assert.equal(projected.length, 1);
  assert.equal(projected[0]?.workspaceId, "workspace-a");
  assert.equal(projected[0]?.attemptId, "attempt-1");
  assert.equal(projected[0]?.providerId, "groq");
});

test("automatic usage projection failure is best-effort and does not block authoritative billing", async () => {
  const pricing = new InMemoryProviderPricingRepository();

  await pricing.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokenPricePerMillion: 0.2,
    outputTokenPricePerMillion: 0.8,
    effectiveFrom: "2026-09-01T00:00:00.000Z",
  });

  const ledger = new InMemoryCostLedgerRepository();

  const factory = new TenantExecutionEventSinkFactory(
    new CostLedgerService(new ExecutionCostCalculator(pricing), ledger),
    {
      async recordExecution() {
        throw new Error("usage projection unavailable");
      },
    }
  );

  const failures: unknown[] = [];

  const sink = factory.create("workspace-a", {
    onBestEffortError(failure) {
      failures.push(failure);
    },
  });

  await assert.doesNotReject(sink.emit(completedEvent()));

  assert.equal((await ledger.list("workspace-a")).length, 1);
  assert.equal(failures.length, 1);
});

test("additional best-effort consumer failure does not block billing or automatic projection", async () => {
  const { ledger, projected, factory } = await createFixture();

  const failures: unknown[] = [];

  const sink = factory.create("workspace-a", {
    bestEffortConsumers: [
      {
        async consume() {
          throw new Error("telemetry unavailable");
        },
      },
    ],
    onBestEffortError(failure) {
      failures.push(failure);
    },
  });

  await assert.doesNotReject(sink.emit(completedEvent()));

  assert.equal((await ledger.list("workspace-a")).length, 1);
  assert.equal(projected.length, 1);
  assert.equal(failures.length, 1);
});

test("tenant execution event sink factory ignores dispatch failure for billing and usage projection", async () => {
  const { ledger, projected, factory } = await createFixture();

  const sink = factory.create("workspace-a");

  const event = completedEvent();

  await sink.emit({
    type: "attempt-dispatch-failed",
    context: event.context,
    error: {} as never,
  });

  assert.deepEqual(await ledger.list("workspace-a"), []);
  assert.deepEqual(projected, []);
});

test("tenant execution event sink factory rejects blank workspace identity", async () => {
  const { factory } = await createFixture();

  assert.throws(() => factory.create("   "), /requires workspace identity/);
});

test("authoritative billing failure remains critical", async () => {
  const pricing = new InMemoryProviderPricingRepository();

  await pricing.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokenPricePerMillion: 0.2,
    outputTokenPricePerMillion: 0.8,
    effectiveFrom: "2026-09-01T00:00:00.000Z",
  });

  const factory = new TenantExecutionEventSinkFactory(
    new CostLedgerService(new ExecutionCostCalculator(pricing), {
      async append() {
        throw new Error("authoritative ledger unavailable");
      },

      async list() {
        return [];
      },

      async totalCost() {
        return 0;
      },

      async periodTotals() {
        return [];
      },
    }),
    {
      async recordExecution() {
        return true;
      },
    }
  );

  const sink = factory.create("workspace-a");

  await assert.rejects(sink.emit(completedEvent()), /authoritative ledger unavailable/);
});
