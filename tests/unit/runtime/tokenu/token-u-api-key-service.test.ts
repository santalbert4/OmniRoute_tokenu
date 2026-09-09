import assert from "node:assert/strict";
import test from "node:test";

import type { TokenUApiKey } from "@/tokenu/contracts/tokenUApiKey";
import { hashTokenUApiKey } from "@/tokenu/runtime/tokenUApiKeyMaterial";
import type { TokenUApiKeyRepository } from "@/tokenu/runtime/tokenUApiKeyRepository";
import { TokenUApiKeyService } from "@/tokenu/runtime/tokenUApiKeyService";

class MemoryRepository implements TokenUApiKeyRepository {
  readonly records = new Map<string, TokenUApiKey>();

  readonly touchCalls: Array<{
    readonly apiKeyId: string;
    readonly usedAt: string;
  }> = [];

  failTouches = false;

  async getById(apiKeyId: string): Promise<TokenUApiKey | null> {
    return this.records.get(apiKeyId) ?? null;
  }

  async getByHash(keyHash: string): Promise<TokenUApiKey | null> {
    for (const record of this.records.values()) {
      if (record.keyHash === keyHash) {
        return record;
      }
    }

    return null;
  }

  async touchLastUsedAt(apiKeyId: string, usedAt: string): Promise<void> {
    this.touchCalls.push({
      apiKeyId,
      usedAt,
    });

    if (this.failTouches) {
      throw new Error("simulated lastUsedAt failure");
    }

    const existing = this.records.get(apiKeyId);

    if (!existing) {
      return;
    }

    if (existing.lastUsedAt !== null && Date.parse(existing.lastUsedAt) >= Date.parse(usedAt)) {
      return;
    }

    this.records.set(apiKeyId, {
      ...existing,
      lastUsedAt: usedAt,
    });
  }

  async save(apiKey: TokenUApiKey): Promise<void> {
    this.records.set(apiKey.id, apiKey);
  }
}

const TOKEN_A = "tku_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const TOKEN_B = "tku_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

function service(repository: MemoryRepository): TokenUApiKeyService {
  return new TokenUApiKeyService(repository, {
    generateId() {
      return "tokenu-key-a";
    },

    generateToken() {
      return TOKEN_A;
    },

    now() {
      return "2026-09-10T00:00:00.000Z";
    },
  });
}

test("TokenU API-key service returns raw token once while persisting hash only", async () => {
  const repository = new MemoryRepository();
  const apiKeys = service(repository);

  const created = await apiKeys.create({
    name: " Production ",
    expiresAt: "2026-10-10T02:00:00+02:00",
  });

  assert.deepEqual(created, {
    id: "tokenu-key-a",
    name: "Production",
    token: TOKEN_A,
    keyPrefix: "tku_AAAAAAAA",
    createdAt: "2026-09-10T00:00:00.000Z",
    expiresAt: "2026-10-10T00:00:00.000Z",
  });

  const stored = await repository.getById("tokenu-key-a");

  assert.deepEqual(stored, {
    id: "tokenu-key-a",
    name: "Production",
    keyPrefix: "tku_AAAAAAAA",
    keyHash: hashTokenUApiKey(TOKEN_A),
    createdAt: "2026-09-10T00:00:00.000Z",
    expiresAt: "2026-10-10T00:00:00.000Z",
    revokedAt: null,
    lastUsedAt: null,
  });

  assert.equal(JSON.stringify(stored).includes(TOKEN_A), false);
});

test("TokenU API-key service resolves only exact active TokenU credential identity", async () => {
  const repository = new MemoryRepository();
  const apiKeys = service(repository);

  await apiKeys.create({
    name: "Production",
  });

  assert.equal(
    await apiKeys.resolvePrincipalId(TOKEN_A, "2026-09-10T12:00:00.000Z"),
    "tokenu-key-a"
  );

  assert.equal(await apiKeys.resolvePrincipalId(TOKEN_B, "2026-09-10T12:00:00.000Z"), null);

  assert.equal(
    await apiKeys.resolvePrincipalId("legacy-api-key", "2026-09-10T12:00:00.000Z"),
    null
  );
});

test("TokenU API-key service fails closed for expired credentials", async () => {
  const repository = new MemoryRepository();

  const apiKeys = new TokenUApiKeyService(repository, {
    generateId: () => "expired-key",
    generateToken: () => TOKEN_A,
    now: () => "2026-09-10T00:00:00.000Z",
  });

  await apiKeys.create({
    name: "Expiring",
    expiresAt: "2026-09-11T00:00:00.000Z",
  });

  assert.equal(
    await apiKeys.resolvePrincipalId(TOKEN_A, "2026-09-10T23:59:59.999Z"),
    "expired-key"
  );

  assert.equal(await apiKeys.resolvePrincipalId(TOKEN_A, "2026-09-11T00:00:00.000Z"), null);
});

test("TokenU API-key service revokes credential identity idempotently", async () => {
  const repository = new MemoryRepository();
  const apiKeys = service(repository);

  await apiKeys.create({
    name: "Production",
  });

  assert.equal(await apiKeys.revoke("tokenu-key-a", "2026-09-10T12:00:00.000Z"), true);

  assert.equal(await apiKeys.resolvePrincipalId(TOKEN_A, "2026-09-10T12:00:01.000Z"), null);

  assert.equal((await repository.getById("tokenu-key-a"))?.revokedAt, "2026-09-10T12:00:00.000Z");

  assert.equal(await apiKeys.revoke("tokenu-key-a", "2026-09-10T13:00:00.000Z"), true);

  assert.equal((await repository.getById("tokenu-key-a"))?.revokedAt, "2026-09-10T12:00:00.000Z");

  assert.equal(await apiKeys.revoke("missing"), false);
});

test("TokenU API-key service rejects invalid creation lifecycle input", async () => {
  const repository = new MemoryRepository();
  const apiKeys = service(repository);

  await assert.rejects(
    apiKeys.create({
      name: " ",
    }),
    /requires name/
  );

  await assert.rejects(
    apiKeys.create({
      name: "Invalid date",
      createdAt: "not-a-date",
    }),
    /Invalid TokenU API key createdAt/
  );

  await assert.rejects(
    apiKeys.create({
      name: "Invalid expiration",
      expiresAt: "2026-09-09T23:59:59.000Z",
    }),
    /expiration must be after creation/
  );
});

test("TokenU API-key service records lastUsedAt only after successful authentication", async () => {
  const repository = new MemoryRepository();
  const apiKeys = service(repository);

  await apiKeys.create({
    name: "Production",
  });

  const resolved = await apiKeys.resolvePrincipalId(TOKEN_A, "2026-09-10T12:34:56.000Z");

  assert.equal(resolved, "tokenu-key-a");

  assert.deepEqual(repository.touchCalls, [
    {
      apiKeyId: "tokenu-key-a",
      usedAt: "2026-09-10T12:34:56.000Z",
    },
  ]);

  assert.equal((await repository.getById("tokenu-key-a"))?.lastUsedAt, "2026-09-10T12:34:56.000Z");

  await apiKeys.resolvePrincipalId(TOKEN_B, "2026-09-10T13:00:00.000Z");

  assert.equal(repository.touchCalls.length, 1);
});

test("TokenU API-key authentication remains available when lastUsedAt telemetry fails", async () => {
  const repository = new MemoryRepository();
  const apiKeys = service(repository);

  await apiKeys.create({
    name: "Production",
  });

  repository.failTouches = true;

  const resolved = await apiKeys.resolvePrincipalId(TOKEN_A, "2026-09-10T12:00:00.000Z");

  assert.equal(resolved, "tokenu-key-a");

  assert.equal(repository.touchCalls.length, 1);

  assert.equal((await repository.getById("tokenu-key-a"))?.lastUsedAt, null);
});

test("TokenU API-key service refuses an invalid token generator", async () => {
  const repository = new MemoryRepository();

  const apiKeys = new TokenUApiKeyService(repository, {
    generateId: () => "key-a",
    generateToken: () => "legacy-secret",
    now: () => "2026-09-10T00:00:00.000Z",
  });

  await assert.rejects(
    apiKeys.create({
      name: "A",
    }),
    /generator returned invalid token/
  );

  assert.equal(repository.records.size, 0);
});
