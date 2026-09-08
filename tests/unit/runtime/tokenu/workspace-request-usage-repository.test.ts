import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryWorkspaceRequestUsageRepository } from "@/tokenu/runtime/inMemoryWorkspaceRequestUsageRepository";

test("workspace request usage increments requests", async () => {
  const repository = new InMemoryWorkspaceRequestUsageRepository();

  await repository.increment("workspace-1", "2026-09");

  await repository.increment("workspace-1", "2026-09");

  const usage = await repository.get("workspace-1", "2026-09");

  assert.equal(usage?.requestCount, 2);
});

test("workspace request usage separates periods", async () => {
  const repository = new InMemoryWorkspaceRequestUsageRepository();

  await repository.increment("workspace-1", "2026-09");

  await repository.increment("workspace-1", "2026-10");

  const september = await repository.get("workspace-1", "2026-09");

  const october = await repository.get("workspace-1", "2026-10");

  assert.equal(september?.requestCount, 1);

  assert.equal(october?.requestCount, 1);
});
