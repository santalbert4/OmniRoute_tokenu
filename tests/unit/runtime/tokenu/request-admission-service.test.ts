import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryWorkspaceRequestUsageRepository } from "@/tokenu/runtime/inMemoryWorkspaceRequestUsageRepository";
import { RequestAdmissionService } from "@/tokenu/runtime/requestAdmissionService";

test("request admission consumes one request slot and returns remaining capacity", async () => {
  const repository = new InMemoryWorkspaceRequestUsageRepository();

  const service = new RequestAdmissionService(repository);

  const first = await service.admit("workspace-a", "2026-09", 2);

  assert.deepEqual(first, {
    admitted: true,
    requestCount: 1,
    remainingRequests: 1,
  });

  const second = await service.admit("workspace-a", "2026-09", 2);

  assert.deepEqual(second, {
    admitted: true,
    requestCount: 2,
    remainingRequests: 0,
  });

  const denied = await service.admit("workspace-a", "2026-09", 2);

  assert.deepEqual(denied, {
    admitted: false,
    remainingRequests: 0,
    reason: "monthly request quota exceeded",
  });

  assert.equal((await repository.get("workspace-a", "2026-09"))?.requestCount, 2);
});

test("request admission rejects missing trusted context and invalid limits", async () => {
  const service = new RequestAdmissionService(new InMemoryWorkspaceRequestUsageRepository());

  await assert.rejects(service.admit("   ", "2026-09", 1), /requires workspace identity/);

  await assert.rejects(service.admit("workspace-a", "   ", 1), /requires usage period/);

  for (const invalidLimit of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      service.admit("workspace-a", "2026-09", invalidLimit),
      /non-negative safe integer/
    );
  }
});
