import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryCostLedgerRepository } from "@/tokenu/runtime/inMemoryCostLedgerRepository";

test("cost ledger stores entries and calculates workspace spend", async () => {
  const repository = new InMemoryCostLedgerRepository();

  await repository.append({
    workspaceId: "workspace-1",
    requestId: "request-1",
    attemptId: "request-1-attempt",
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
    workspaceId: "workspace-1",
    requestId: "request-2",
    attemptId: "request-2-attempt",
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

test("cost ledger append is idempotent for the same workspace attempt", async () => {
  const repository = new InMemoryCostLedgerRepository();

  const entry = {
    workspaceId: "workspace-1",
    requestId: "request-1",
    attemptId: "attempt-1",
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 0.0006,
    createdAt: "2026-09-08T12:00:00.000Z",
  };

  assert.equal(await repository.append(entry), true);

  assert.equal(await repository.append(entry), false);

  assert.equal((await repository.list("workspace-1")).length, 1);

  assert.equal(await repository.totalCost("workspace-1"), 0.0006);
});

test("cost ledger rejects conflicting data for an existing workspace attempt", async () => {
  const repository = new InMemoryCostLedgerRepository();

  await repository.append({
    workspaceId: "workspace-1",
    requestId: "request-1",
    attemptId: "attempt-1",
    providerId: "groq",
    modelId: "llama-test",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 0.0006,
    createdAt: "2026-09-08T12:00:00.000Z",
  });

  await assert.rejects(
    repository.append({
      workspaceId: "workspace-1",
      requestId: "request-1",
      attemptId: "attempt-1",
      providerId: "groq",
      modelId: "llama-test",
      currency: "USD",
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      cost: 0.001,
      createdAt: "2026-09-08T12:00:00.000Z",
    }),
    /already exists with different data/
  );

  assert.equal((await repository.list("workspace-1")).length, 1);
});
