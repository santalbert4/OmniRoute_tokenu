import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import {
  createTokenURuntimeComposition,
  getTokenURuntimeComposition,
} from "@/tokenu/runtime/tokenuRuntimeComposition";

interface RawStatement {
  get(...params: unknown[]): unknown;

  all(...params: unknown[]): readonly unknown[];

  run(...params: unknown[]): {
    readonly changes?: number;
  };
}

interface RawDatabase {
  exec(sql: string): void;

  prepare(sql: string): RawStatement;

  close(): void;
}

const require = createRequire(import.meta.url);

const BetterSqlite3 = require("better-sqlite3") as new (filename: string) => RawDatabase;

function createDatabase(): RawDatabase {
  const db = new BetterSqlite3(":memory:");

  for (const migration of [
    "173_tokenu_workspace_identity.sql",
    "174_tokenu_workspace_plans.sql",
    "175_tokenu_usage_metering.sql",
    "176_tokenu_cost_ledger.sql",
  ]) {
    db.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db as unknown as TokenUSqliteDatabase;
}

test("TokenU runtime composition shares persistent SQLite state across identity usage quota and overview", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const database = asTokenUDatabase(db);

  const runtime = createTokenURuntimeComposition(database);

  assert.equal(runtime.database, database);

  await runtime.workspaceRepository.save({
    id: "workspace-a",
    createdAt: "2026-09-09T00:00:00.000Z",
  });

  await runtime.workspacePrincipalRepository.save({
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "api-key-a",
    assignedAt: "2026-09-09T00:01:00.000Z",
  });

  assert.deepEqual(await runtime.workspacePrincipalRepository.get("api_key", "api-key-a"), {
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "api-key-a",
    assignedAt: "2026-09-09T00:01:00.000Z",
  });

  const plan = {
    id: "starter",
    tier: "starter" as const,
    monthlyCostLimit: 1,
    monthlyRequestLimit: 3,
    currency: "USD",
  };

  await runtime.workspacePlanRepository.save(plan);

  await runtime.workspacePlanAssignmentRepository.save({
    workspaceId: "workspace-a",
    planId: "starter",
    assignedAt: "2026-09-09T00:02:00.000Z",
  });

  await runtime.workspaceRequestUsageRepository.increment("workspace-a", "2026-09");

  await runtime.workspaceRequestUsageRepository.increment("workspace-a", "2026-09");

  await runtime.workspaceUsageMeteringService.record("workspace-a", "2026-09", 1000, 500, 99);

  await runtime.workspaceUsageMeteringService.record("workspace-a", "2026-09", 2000, 1000, 88);

  await runtime.providerUsageMeteringService.record(
    "workspace-a",
    "2026-09",
    "openai",
    "gpt-test",
    1000,
    500,
    77
  );

  await runtime.providerUsageMeteringService.record(
    "workspace-a",
    "2026-09",
    "openai",
    "gpt-test",
    2000,
    1000,
    66
  );

  await runtime.costLedgerRepository.append({
    workspaceId: "workspace-a",
    requestId: "request-1",
    attemptId: "attempt-1",
    providerId: "openai",
    modelId: "gpt-test",
    currency: "USD",
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    cost: 0.25,
    createdAt: "2026-09-09T10:00:00.000Z",
  });

  await runtime.costLedgerRepository.append({
    workspaceId: "workspace-a",
    requestId: "request-2",
    attemptId: "attempt-2",
    providerId: "openai",
    modelId: "gpt-test",
    currency: "USD",
    inputTokens: 2000,
    outputTokens: 1000,
    totalTokens: 3000,
    cost: 0.15,
    createdAt: "2026-09-09T10:01:00.000Z",
  });

  const overview = await runtime.workspaceUsageQueryService.getOverview("workspace-a", "2026-09");

  assert.deepEqual(overview, {
    workspaceId: "workspace-a",
    period: "2026-09",

    plan: {
      id: "starter",
      tier: "starter",
      currency: "USD",
    },

    requests: {
      used: 2,
      limit: 3,
      remaining: 1,
    },

    metering: {
      meteredExecutionCount: 2,
      inputTokens: 3000,
      outputTokens: 1500,
      totalTokens: 4500,
    },

    spend: {
      total: 0.4,
      limit: 1,
      remaining: 0.6,
      utilizationPercent: 40,
      currency: "USD",
    },

    providers: [
      {
        providerId: "openai",
        modelId: "gpt-test",
        requestCount: 2,
        inputTokens: 3000,
        outputTokens: 1500,
      },
    ],
  });

  const quota = await runtime.workspaceQuotaGateService.evaluate("workspace-a", "2026-09", plan);

  assert.deepEqual(quota, {
    allowed: true,
    reason: null,
    remainingCost: 0.6,
    remainingRequests: 1,
  });

  const preflight = await runtime.tenantExecutionPreflightService.evaluate(
    "workspace-a",
    "2026-09"
  );

  assert.equal(preflight.status, "allowed");

  if (preflight.status !== "allowed") {
    assert.fail("Expected runtime preflight to allow execution");
  }

  assert.equal(preflight.plan.id, "starter");
  assert.equal(preflight.quota.remainingRequests, 1);

  await runtime.workspaceRequestUsageRepository.increment("workspace-a", "2026-09");

  const exhausted = await runtime.workspaceQuotaGateService.evaluate(
    "workspace-a",
    "2026-09",
    plan
  );

  assert.deepEqual(exhausted, {
    allowed: false,
    reason: "monthly request quota exceeded",
    remainingCost: 0.6,
    remainingRequests: 0,
  });

  const deniedPreflight = await runtime.tenantExecutionPreflightService.evaluate(
    "workspace-a",
    "2026-09"
  );

  assert.equal(deniedPreflight.status, "quota-denied");

  if (deniedPreflight.status !== "quota-denied") {
    assert.fail("Expected runtime preflight quota denial");
  }

  assert.equal(deniedPreflight.quota.reason, "monthly request quota exceeded");
});

test("TokenU runtime composition getter returns one singleton instance", () => {
  const first = getTokenURuntimeComposition();

  const second = getTokenURuntimeComposition();

  assert.equal(first, second);

  assert.equal(first.database, second.database);

  assert.equal(first.costLedgerRepository, second.costLedgerRepository);

  assert.equal(first.tenantExecutionPreflightService, second.tenantExecutionPreflightService);

  assert.equal(first.workspaceUsageQueryService, second.workspaceUsageQueryService);
});
