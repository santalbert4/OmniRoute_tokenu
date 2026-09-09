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

test("workspace request usage admits atomically only up to the monthly limit", async () => {
  const repository = new InMemoryWorkspaceRequestUsageRepository();

  const results = await Promise.all(
    Array.from({ length: 10 }, () => repository.tryConsume("workspace-1", "2026-09", 3))
  );

  assert.equal(results.filter((result) => result.admitted).length, 3);

  assert.equal(results.filter((result) => !result.admitted).length, 7);

  assert.equal((await repository.get("workspace-1", "2026-09"))?.requestCount, 3);
});

test("workspace request usage rejects zero request limit without creating usage", async () => {
  const repository = new InMemoryWorkspaceRequestUsageRepository();

  const result = await repository.tryConsume("workspace-1", "2026-09", 0);

  assert.deepEqual(result, {
    admitted: false,
    remainingRequests: 0,
    reason: "monthly request quota exceeded",
  });

  assert.equal(await repository.get("workspace-1", "2026-09"), null);
});

test("workspace request admission isolates workspace and period counters", async () => {
  const repository = new InMemoryWorkspaceRequestUsageRepository();

  await repository.tryConsume("workspace-1", "2026-09", 1);

  assert.equal((await repository.tryConsume("workspace-1", "2026-09", 1)).admitted, false);

  assert.equal((await repository.tryConsume("workspace-1", "2026-10", 1)).admitted, true);

  assert.equal((await repository.tryConsume("workspace-2", "2026-09", 1)).admitted, true);
});
