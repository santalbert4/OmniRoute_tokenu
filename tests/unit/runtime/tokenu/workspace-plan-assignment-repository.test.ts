import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryWorkspacePlanAssignmentRepository } from "@/tokenu/runtime/inMemoryWorkspacePlanAssignmentRepository";

test("workspace plan assignment stores workspace plan relation", async () => {
  const repository = new InMemoryWorkspacePlanAssignmentRepository();

  await repository.save({
    workspaceId: "workspace-1",
    planId: "pro",
    assignedAt: "2026-09-08T12:00:00.000Z",
  });

  const assignment = await repository.get("workspace-1");

  assert.equal(assignment?.planId, "pro");

  assert.equal(assignment?.workspaceId, "workspace-1");
});
