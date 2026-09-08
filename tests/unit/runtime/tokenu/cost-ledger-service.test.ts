import assert from "node:assert/strict";
import test from "node:test";

import { CostLedgerService } from "@/tokenu/runtime/costLedgerService";
import { ExecutionCostCalculator } from "@/tokenu/runtime/executionCostCalculator";
import { InMemoryCostLedgerRepository } from "@/tokenu/runtime/inMemoryCostLedgerRepository";
import { InMemoryProviderPricingRepository } from "@/tokenu/runtime/inMemoryProviderPricingRepository";

test("cost ledger service records execution cost", async () => {
  const pricingRepository = new InMemoryProviderPricingRepository();

  await pricingRepository.save({
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokenPricePerMillion: 0.2,
    outputTokenPricePerMillion: 0.8,
    effectiveFrom: "2026-09-08T00:00:00.000Z",
  });

  const calculator = new ExecutionCostCalculator(pricingRepository);

  const ledgerRepository = new InMemoryCostLedgerRepository();

  const service = new CostLedgerService(calculator, ledgerRepository);

  await service.recordExecution({
    id: "entry-1",
    workspaceId: "workspace-1",
    requestId: "request-1",
    providerId: "groq",
    modelId: "llama-test",
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      reasoningTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: 1500,
    },
    recordedAt: "2026-09-08T12:00:00.000Z",
  });

  const total = await ledgerRepository.totalCost("workspace-1");

  assert.equal(total, 0.0006);
});
