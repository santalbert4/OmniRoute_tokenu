import assert from "node:assert/strict";
import test from "node:test";

import { WorkspacePlanResolverService } from "@/tokenu/runtime/workspacePlanResolverService";
import { InMemoryWorkspacePlanAssignmentRepository } from "@/tokenu/runtime/inMemoryWorkspacePlanAssignmentRepository";
import { InMemoryWorkspacePlanRepository } from "@/tokenu/runtime/inMemoryWorkspacePlanRepository";

test("workspace plan resolver resolves assigned workspace plan", async () => {
  const assignmentRepository = new InMemoryWorkspacePlanAssignmentRepository();

  const planRepository = new InMemoryWorkspacePlanRepository();

  await planRepository.save({
    id: "pro",
    tier: "pro",
    monthlyCostLimit: 50,
    monthlyRequestLimit: 10000,
    currency: "USD",
  });

  await assignmentRepository.save({
    workspaceId: "workspace-1",
    planId: "pro",
    assignedAt: "2026-09-08T12:00:00.000Z",
  });

  const service = new WorkspacePlanResolverService(assignmentRepository, planRepository);

  const plan = await service.resolve("workspace-1");

  assert.equal(plan?.tier, "pro");

  assert.equal(plan?.monthlyCostLimit, 50);
});

test("workspace plan resolver returns null without assignment", async () => {
  const service = new WorkspacePlanResolverService(
    new InMemoryWorkspacePlanAssignmentRepository(),
    new InMemoryWorkspacePlanRepository()
  );

  const plan = await service.resolve("unknown");

  assert.equal(plan, null);
});
