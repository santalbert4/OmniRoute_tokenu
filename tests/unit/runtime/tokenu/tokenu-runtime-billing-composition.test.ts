import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import { createTokenURuntimeComposition } from "@/tokenu/runtime/tokenuRuntimeComposition";

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
    "176_tokenu_cost_ledger.sql",
    "177_tokenu_provider_pricing.sql",
  ]) {
    db.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db as unknown as TokenUSqliteDatabase;
}

test("TokenU runtime billing uses historical persistent pricing and records authoritative ledger cost", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const runtime = createTokenURuntimeComposition(asTokenUDatabase(db));

  await runtime.workspaceRepository.save({
    id: "workspace-billing",
    createdAt: "2026-09-01T00:00:00.000Z",
  });

  await runtime.providerPricingRepository.save({
    providerId: "openai",
    modelId: "gpt-billing-test",
    currency: "USD",
    inputTokenPricePerMillion: 1.5,
    outputTokenPricePerMillion: 6,
    effectiveFrom: "2026-06-01T00:00:00.000Z",
  });

  await runtime.providerPricingRepository.save({
    providerId: "openai",
    modelId: "gpt-billing-test",
    currency: "USD",
    inputTokenPricePerMillion: 10,
    outputTokenPricePerMillion: 20,
    effectiveFrom: "2026-10-01T00:00:00.000Z",
  });

  const first = await runtime.costLedgerService.recordExecution({
    workspaceId: "workspace-billing",
    requestId: "request-september",
    attemptId: "attempt-september",
    providerId: "openai",
    modelId: "gpt-billing-test",
    usage: {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      reasoningTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: 1_500_000,
    },
    recordedAt: "2026-09-15T12:00:00.000Z",
  });

  assert.deepEqual(first, {
    recorded: true,
    cost: 4.5,
    entryId: "attempt-september",
  });

  const duplicate = await runtime.costLedgerService.recordExecution({
    workspaceId: "workspace-billing",
    requestId: "request-september",
    attemptId: "attempt-september",
    providerId: "openai",
    modelId: "gpt-billing-test",
    usage: {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      reasoningTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      totalTokens: 1_500_000,
    },
    recordedAt: "2026-09-15T12:00:00.000Z",
  });

  assert.deepEqual(duplicate, {
    recorded: false,
    cost: 0,
    entryId: "attempt-september",
  });

  assert.deepEqual(await runtime.costLedgerRepository.list("workspace-billing"), [
    {
      workspaceId: "workspace-billing",
      requestId: "request-september",
      attemptId: "attempt-september",
      providerId: "openai",
      modelId: "gpt-billing-test",
      currency: "USD",
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      totalTokens: 1_500_000,
      cost: 4.5,
      createdAt: "2026-09-15T12:00:00.000Z",
    },
  ]);

  const raw = db
    .prepare(
      `SELECT
         cost_micros,
         typeof(cost_micros) AS cost_type
       FROM tokenu_cost_ledger
       WHERE workspace_id = ?
         AND attempt_id = ?`
    )
    .get("workspace-billing", "attempt-september") as {
    cost_micros: number;
    cost_type: string;
  };

  assert.deepEqual(raw, {
    cost_micros: 4_500_000,
    cost_type: "integer",
  });
});
