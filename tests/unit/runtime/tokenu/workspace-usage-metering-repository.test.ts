import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryWorkspaceUsageMeteringRepository } from "@/tokenu/runtime/inMemoryWorkspaceUsageMeteringRepository";

test("workspace usage metering stores usage snapshot", async () => {
  const repository = new InMemoryWorkspaceUsageMeteringRepository();

  await repository.save({
    workspaceId: "workspace-1",
    period: "2026-09",
    meteredExecutionCount: 10,
    inputTokens: 5000,
    outputTokens: 2500,
    estimatedCost: 0.25,
  });

  const usage = await repository.get("workspace-1", "2026-09");

  assert.equal(usage?.meteredExecutionCount, 10);

  assert.equal(usage?.estimatedCost, 0.25);
});

test("workspace usage metering repository increments usage deltas", async () => {
  const repository = new InMemoryWorkspaceUsageMeteringRepository();

  await repository.increment("workspace-1", "2026-09", {
    inputTokens: 1000,
    outputTokens: 500,
    estimatedCost: 0.05,
  });

  await repository.increment("workspace-1", "2026-09", {
    inputTokens: 2000,
    outputTokens: 1000,
    estimatedCost: 0.1,
  });

  const usage = await repository.get("workspace-1", "2026-09");

  assert.equal(usage?.meteredExecutionCount, 2);

  assert.equal(usage?.inputTokens, 3000);

  assert.equal(usage?.outputTokens, 1500);

  assert.equal(usage?.estimatedCost, 0.15);
});
