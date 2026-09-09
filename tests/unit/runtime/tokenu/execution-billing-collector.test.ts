import assert from "node:assert/strict";
import test from "node:test";

import { CostLedgerService } from "@/tokenu/runtime/costLedgerService";
import { ExecutionBillingCollector } from "@/tokenu/runtime/executionBillingCollector";
import { ExecutionCostCalculator } from "@/tokenu/runtime/executionCostCalculator";
import { InMemoryCostLedgerRepository } from "@/tokenu/runtime/inMemoryCostLedgerRepository";
import { InMemoryProviderPricingRepository } from "@/tokenu/runtime/inMemoryProviderPricingRepository";

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

test("execution billing collector records completed attempt against trusted workspace", async () => {
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

  const collector = new ExecutionBillingCollector(
    "workspace-a",
    new CostLedgerService(new ExecutionCostCalculator(pricing), ledger)
  );

  await collector.consume(completedEvent());

  const entries = await ledger.list("workspace-a");

  assert.equal(entries.length, 1);

  const entry = entries[0]!;

  assert.deepEqual(
    {
      ...entry,
      cost: undefined,
    },
    {
      workspaceId: "workspace-a",
      requestId: "request-1",
      attemptId: "attempt-1",
      providerId: "groq",
      modelId: "llama-test",
      currency: "USD",
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      cost: undefined,
      createdAt: "2026-09-09T10:00:01.000Z",
    }
  );

  assert.ok(Math.abs(entry.cost - 0.0006) < 1e-12);
});

test("execution billing collector records an executed failed attempt when usage exists", async () => {
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

  const collector = new ExecutionBillingCollector(
    "workspace-a",
    new CostLedgerService(new ExecutionCostCalculator(pricing), ledger)
  );

  const event = completedEvent();

  await collector.consume({
    ...event,
    result: {
      ...event.result,
      status: "failed",
      error: {} as never,
      retryability: "retryable",
    },
  });

  const entries = await ledger.list("workspace-a");

  assert.equal(entries.length, 1);

  assert.equal(entries[0]?.attemptId, "attempt-1");

  assert.ok(Math.abs((await ledger.totalCost("workspace-a")) - 0.0006) < 1e-12);
});

test("execution billing collector ignores non-completed events", async () => {
  const ledger = new InMemoryCostLedgerRepository();

  const collector = new ExecutionBillingCollector(
    "workspace-a",
    new CostLedgerService(
      new ExecutionCostCalculator(new InMemoryProviderPricingRepository()),
      ledger
    )
  );

  const event = completedEvent();

  await collector.consume({
    type: "attempt-started",
    context: event.context,
  });

  await collector.consume({
    type: "attempt-dispatch-failed",
    context: event.context,
    error: {} as never,
  });

  assert.deepEqual(await ledger.list("workspace-a"), []);
});

test("execution billing collector remains idempotent for repeated completed event", async () => {
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

  const collector = new ExecutionBillingCollector(
    "workspace-a",
    new CostLedgerService(new ExecutionCostCalculator(pricing), ledger)
  );

  const event = completedEvent();

  await collector.consume(event);
  await collector.consume(event);

  assert.equal((await ledger.list("workspace-a")).length, 1);

  assert.ok(Math.abs((await ledger.totalCost("workspace-a")) - 0.0006) < 1e-12);
});

test("execution billing collector rejects blank workspace identity", () => {
  assert.throws(
    () =>
      new ExecutionBillingCollector(
        "   ",
        new CostLedgerService(
          new ExecutionCostCalculator(new InMemoryProviderPricingRepository()),
          new InMemoryCostLedgerRepository()
        )
      ),
    /requires workspace identity/
  );
});
