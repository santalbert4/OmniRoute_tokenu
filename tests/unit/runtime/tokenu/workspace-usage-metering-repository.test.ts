import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryWorkspaceUsageMeteringRepository } from "@/tokenu/runtime/inMemoryWorkspaceUsageMeteringRepository";

test("workspace usage metering stores usage snapshot", async () => {
  const repository = new InMemoryWorkspaceUsageMeteringRepository();

  await repository.save({
    workspaceId: "workspace-1",
    period: "2026-09",
    requestCount: 10,
    inputTokens: 5000,
    outputTokens: 2500,
    estimatedCost: 0.25,
  });

  const usage = await repository.get("workspace-1", "2026-09");

  assert.equal(usage?.requestCount, 10);

  assert.equal(usage?.estimatedCost, 0.25);
});
