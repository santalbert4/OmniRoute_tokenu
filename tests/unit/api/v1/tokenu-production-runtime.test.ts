import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import test from "node:test";

import { createTokenUProductionRuntimeComposition } from "@/app/api/v1/tokenu/productionRuntime";
import { AesGcmCredentialCipher } from "@/tokenu/adapters/security/aesGcmCredentialCipher";
import { SqliteProviderConnectionRepository } from "@/tokenu/adapters/storage/sqliteProviderConnectionRepository";
import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import {
  GROQ_GPT_OSS_20B_PROVIDER_PRICING,
  GROQ_MANAGED_CONNECTION_ID,
} from "@/tokenu/runtime/productionGroqCatalog";
import { ProviderConnectionService } from "@/tokenu/runtime/providerConnectionService";

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

  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T;

  close(): void;
}

const require = createRequire(import.meta.url);

const BetterSqlite3 = require("better-sqlite3") as new (filename: string) => RawDatabase;

const masterKey = "tokenu-production-test-master-key-0123456789abcdef";

function createDatabase(): RawDatabase {
  const db = new BetterSqlite3(":memory:");

  for (const migration of [
    "173_tokenu_workspace_identity.sql",
    "174_tokenu_workspace_plans.sql",
    "175_tokenu_usage_metering.sql",
    "176_tokenu_cost_ledger.sql",
    "177_tokenu_provider_pricing.sql",
    "178_tokenu_usage_projection_attempts.sql",
    "179_tokenu_provider_connections.sql",
    "180_tokenu_provider_pricing_cache.sql",
  ]) {
    db.exec(fs.readFileSync(`src/lib/db/migrations/${migration}`, "utf8"));
  }

  return db;
}

function asTokenUDatabase(db: RawDatabase): TokenUSqliteDatabase {
  return db as unknown as TokenUSqliteDatabase;
}

async function provisionGroq(
  db: RawDatabase,
  options?: {
    readonly enabled?: boolean;
    readonly encryptionKey?: string;
  }
): Promise<void> {
  const repository = new SqliteProviderConnectionRepository(asTokenUDatabase(db));

  const cipher = new AesGcmCredentialCipher(options?.encryptionKey ?? masterKey);

  const service = new ProviderConnectionService(repository, cipher);

  await service.saveManagedCredential({
    connectionId: GROQ_MANAGED_CONNECTION_ID,
    providerId: "groq",
    credentialKind: "api-key",
    plaintextCredential: "gsk_runtime_test_secret",
    enabled: options?.enabled ?? true,
    recordedAt: "2026-09-09T00:00:00.000Z",
  });
}

test("production TokenU runtime remains fail closed without groq-managed connection", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  const runtime = await createTokenUProductionRuntimeComposition({
    database: asTokenUDatabase(db),
    credentialMasterKey: masterKey,
  });

  assert.equal(
    runtime.publicExecutionResolver.resolve({
      requestId: "request-no-groq",
      publicModelId: "gpt-oss-20b",
    }),
    null
  );
});

test("production TokenU runtime remains fail closed when groq-managed connection is disabled", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  await provisionGroq(db, {
    enabled: false,
  });

  const runtime = await createTokenUProductionRuntimeComposition({
    database: asTokenUDatabase(db),
    credentialMasterKey: masterKey,
  });

  assert.equal(
    runtime.publicExecutionResolver.resolve({
      requestId: "request-disabled-groq",
      publicModelId: "gpt-oss-20b",
    }),
    null
  );
});

test("production TokenU runtime activates exact Groq route only after managed credential validation", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  await provisionGroq(db);

  const runtime = await createTokenUProductionRuntimeComposition({
    database: asTokenUDatabase(db),
    credentialMasterKey: masterKey,
  });

  const plan = runtime.publicExecutionResolver.resolve({
    requestId: "request-production-groq",
    publicModelId: "gpt-oss-20b",
  });

  assert.ok(plan);

  assert.equal(plan.attempts.length, 1);

  assert.deepEqual(plan.attempts[0]?.target, {
    providerId: "groq",
    modelOfferingId: "groq:openai/gpt-oss-20b",
    upstreamModelId: "openai/gpt-oss-20b",
    connectionId: "groq-managed",
    credentialMode: "TOKENU_MANAGED",
    technicalProfileId: "groq-gpt-oss-20b-profile",
    adapterId: "groq-official-openai-v1",
    endpointProfileId: "groq-official-chat-completions",
    serviceRegion: null,
  });

  const pricing = await runtime.providerPricingRepository.findEffective(
    "groq",
    "openai/gpt-oss-20b",
    "2026-09-09T12:00:00.000Z"
  );

  assert.ok(pricing);

  assert.equal(pricing.providerId, GROQ_GPT_OSS_20B_PROVIDER_PRICING.providerId);

  assert.equal(pricing.modelId, GROQ_GPT_OSS_20B_PROVIDER_PRICING.modelId);

  assert.equal(pricing.currency, GROQ_GPT_OSS_20B_PROVIDER_PRICING.currency);

  assert.equal(
    pricing.inputTokenPricePerMillion,
    GROQ_GPT_OSS_20B_PROVIDER_PRICING.inputTokenPricePerMillion
  );

  assert.equal(
    pricing.outputTokenPricePerMillion,
    GROQ_GPT_OSS_20B_PROVIDER_PRICING.outputTokenPricePerMillion
  );

  assert.equal(
    pricing.cacheReadTokenPricePerMillion,
    GROQ_GPT_OSS_20B_PROVIDER_PRICING.cacheReadTokenPricePerMillion
  );

  assert.equal(
    pricing.cacheWriteTokenPricePerMillion ?? null,
    GROQ_GPT_OSS_20B_PROVIDER_PRICING.cacheWriteTokenPricePerMillion ?? null
  );

  assert.equal(pricing.effectiveFrom, GROQ_GPT_OSS_20B_PROVIDER_PRICING.effectiveFrom);
});

test("production TokenU runtime rejects an enabled managed connection encrypted under another master key", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  await provisionGroq(db, {
    encryptionKey: "another-production-master-key-0123456789abcdef",
  });

  await assert.rejects(
    createTokenUProductionRuntimeComposition({
      database: asTokenUDatabase(db),
      credentialMasterKey: masterKey,
    }),
    /credential could not be decrypted/
  );
});

test("production TokenU runtime rejects blank master key input", async (t) => {
  const db = createDatabase();

  t.after(() => db.close());

  await assert.rejects(
    createTokenUProductionRuntimeComposition({
      database: asTokenUDatabase(db),
      credentialMasterKey: " ",
    }),
    /requires a credential master key/
  );
});
