import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryCostLedgerRepository } from "@/tokenu/runtime/inMemoryCostLedgerRepository";

test("cost ledger stores entries and calculates workspace spend", async () => {
  const repository = new InMemoryCostLedgerRepository();

  await repository.append({
    id: "entry-1",
    workspaceId: "workspace-1",
    requestId: "request-1",
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 0.0006,
    createdAt: "2026-09-08T12:00:00.000Z",
  });

  await repository.append({
    id: "entry-2",
    workspaceId: "workspace-1",
    requestId: "request-2",
    providerId: "openai",
    modelId: "gpt-test",
    currency: "USD",
    inputTokens: 2000,
    outputTokens: 1000,
    totalTokens: 3000,
    cost: 0.003,
    createdAt: "2026-09-08T12:01:00.000Z",
  });

  const entries = await repository.list("workspace-1");

  assert.equal(entries.length, 2);

  const total = await repository.totalCost("workspace-1");

  assert.equal(total, 0.0036);
});
