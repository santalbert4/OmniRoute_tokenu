import assert from "node:assert/strict";
import test from "node:test";

import { WorkspaceUsageMeteringService } from "@/tokenu/runtime/workspaceUsageMeteringService";
import { InMemoryWorkspaceUsageMeteringRepository } from "@/tokenu/runtime/inMemoryWorkspaceUsageMeteringRepository";

test("workspace usage metering accumulates repeated usage", async () => {
  const repository = new InMemoryWorkspaceUsageMeteringRepository();

  const service = new WorkspaceUsageMeteringService(repository);

  await service.record("workspace-1", "2026-09", 1000, 500, 0.05);

  await service.record("workspace-1", "2026-09", 2000, 1000, 0.1);

  const usage = await repository.get("workspace-1", "2026-09");

  assert.equal(usage?.requestCount, 2);

  assert.equal(usage?.inputTokens, 3000);

  assert.equal(usage?.outputTokens, 1500);

  assert.equal(usage?.estimatedCost, 0.15);
});
