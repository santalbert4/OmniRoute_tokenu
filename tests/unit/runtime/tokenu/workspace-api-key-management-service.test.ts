import assert from "node:assert/strict";
import test from "node:test";

import type { TokenUApiKey } from "@/tokenu/contracts/tokenUApiKey";
import { InMemoryWorkspacePrincipalRepository } from "@/tokenu/runtime/inMemoryWorkspacePrincipalRepository";
import { hashTokenUApiKey } from "@/tokenu/runtime/tokenUApiKeyMaterial";
import type { TokenUApiKeyRepository } from "@/tokenu/runtime/tokenUApiKeyRepository";
import { TokenUApiKeyService } from "@/tokenu/runtime/tokenUApiKeyService";
import { WorkspaceApiKeyManagementService } from "@/tokenu/runtime/workspaceApiKeyManagementService";
import type {
  ProvisionWorkspaceApiKeyInput,
  WorkspaceApiKeyProvisioningRepository,
} from "@/tokenu/runtime/workspaceApiKeyProvisioningRepository";

const TOKEN_A = "tku_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const TOKEN_B = "tku_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

const TOKEN_C = "tku_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

class MemoryApiKeyRepository implements TokenUApiKeyRepository {
  readonly records = new Map<string, TokenUApiKey>();

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

class MemoryProvisioningRepository implements WorkspaceApiKeyProvisioningRepository {
  failWith: Error | null = null;

  readonly calls: ProvisionWorkspaceApiKeyInput[] = [];

  constructor(
    private readonly apiKeys: MemoryApiKeyRepository,
    private readonly principals: InMemoryWorkspacePrincipalRepository
  ) {}

  async provision(input: ProvisionWorkspaceApiKeyInput): Promise<void> {
    this.calls.push(input);

    if (this.failWith) {
      throw this.failWith;
    }

    await this.apiKeys.save(input.apiKey);

    await this.principals.save({
      workspaceId: input.workspaceId,
      principalType: "api_key",
      principalId: input.apiKey.id,
      assignedAt: input.assignedAt,
    });
  }
}

function createHarness() {
  const apiKeyRepository = new MemoryApiKeyRepository();

  const principals = new InMemoryWorkspacePrincipalRepository();

  const provisioning = new MemoryProvisioningRepository(apiKeyRepository, principals);

  const ids = ["key-a", "key-b", "key-c"];

  const tokens = [TOKEN_A, TOKEN_B, TOKEN_C];

  const apiKeyService = new TokenUApiKeyService(apiKeyRepository, {
    generateId() {
      const id = ids.shift();

      if (!id) {
        throw new Error("test key identity exhausted");
      }

      return id;
    },

    generateToken() {
      const token = tokens.shift();

      if (!token) {
        throw new Error("test bearer material exhausted");
      }

      return token;
    },

    now() {
      return "2026-09-10T00:00:00.000Z";
    },
  });

  const management = new WorkspaceApiKeyManagementService(apiKeyService, provisioning, principals, {
    now() {
      return "2026-09-15T00:00:00.000Z";
    },
  });

  return {
    apiKeyRepository,
    principals,
    provisioning,
    apiKeyService,
    management,
  };
}

test("workspace API-key management creates credential and trusted workspace binding through atomic port", async () => {
  const { apiKeyRepository, principals, provisioning, management } = createHarness();

  const created = await management.create(" workspace-a ", {
    name: " Production ",
    expiresAt: "2026-10-10T00:00:00.000Z",
  });

  assert.deepEqual(created, {
    id: "key-a",
    name: "Production",
    token: TOKEN_A,
    keyPrefix: "tku_AAAAAAAA",
    createdAt: "2026-09-10T00:00:00.000Z",
    expiresAt: "2026-10-10T00:00:00.000Z",
  });

  assert.equal(provisioning.calls.length, 1);

  assert.equal(provisioning.calls[0]?.workspaceId, "workspace-a");

  assert.equal(provisioning.calls[0]?.assignedAt, "2026-09-10T00:00:00.000Z");

  assert.equal(provisioning.calls[0]?.apiKey.keyHash, hashTokenUApiKey(TOKEN_A));

  assert.equal(JSON.stringify(provisioning.calls[0]?.apiKey).includes(TOKEN_A), false);

  assert.deepEqual(await principals.get("api_key", "key-a"), {
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "key-a",
    assignedAt: "2026-09-10T00:00:00.000Z",
  });

  assert.equal((await apiKeyRepository.getById("key-a"))?.keyHash, hashTokenUApiKey(TOKEN_A));
});

test("workspace API-key management exposes no credential when atomic provisioning fails", async () => {
  const { apiKeyRepository, provisioning, principals, management } = createHarness();

  provisioning.failWith = new Error("simulated workspace provisioning failure");

  await assert.rejects(
    management.create("workspace-a", {
      name: "Failure",
    }),
    /simulated workspace provisioning failure/
  );

  assert.equal(apiKeyRepository.records.size, 0);

  assert.deepEqual(await principals.listByWorkspace("workspace-a"), []);
});

test("workspace API-key management lists only safe metadata for the trusted workspace", async () => {
  const { management } = createHarness();

  await management.create("workspace-a", {
    name: "A active",
  });

  await management.create("workspace-b", {
    name: "B private",
  });

  await management.create("workspace-a", {
    name: "A expiring",
    expiresAt: "2026-09-12T00:00:00.000Z",
  });

  const listed = await management.list("workspace-a", "2026-09-15T00:00:00.000Z");

  assert.deepEqual(listed, [
    {
      id: "key-a",
      name: "A active",
      keyPrefix: "tku_AAAAAAAA",
      createdAt: "2026-09-10T00:00:00.000Z",
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
      status: "active",
    },
    {
      id: "key-c",
      name: "A expiring",
      keyPrefix: "tku_CCCCCCCC",
      createdAt: "2026-09-10T00:00:00.000Z",
      expiresAt: "2026-09-12T00:00:00.000Z",
      revokedAt: null,
      lastUsedAt: null,
      status: "expired",
    },
  ]);

  const serialized = JSON.stringify(listed);

  assert.equal(serialized.includes("keyHash"), false);

  assert.equal(serialized.includes(TOKEN_A), false);

  assert.equal(serialized.includes(TOKEN_B), false);

  assert.equal(serialized.includes(TOKEN_C), false);

  assert.equal(serialized.includes("B private"), false);
});

test("workspace API-key management fails closed on a dangling workspace principal", async () => {
  const { principals, management } = createHarness();

  await principals.save({
    workspaceId: "workspace-a",
    principalType: "api_key",
    principalId: "missing-credential",
    assignedAt: "2026-09-10T01:00:00.000Z",
  });

  await assert.rejects(
    management.list("workspace-a", "2026-09-15T00:00:00.000Z"),
    /references missing API-key credential/
  );
});

test("workspace API-key management revokes only keys owned by the trusted workspace", async () => {
  const { apiKeyService, management } = createHarness();

  const keyA = await management.create("workspace-a", {
    name: "A",
  });

  const keyB = await management.create("workspace-b", {
    name: "B",
  });

  assert.equal(await management.revoke("workspace-a", keyB.id, "2026-09-16T00:00:00.000Z"), false);

  assert.equal(
    (await apiKeyService.getMetadata(keyB.id, "2026-09-17T00:00:00.000Z"))?.status,
    "active"
  );

  assert.equal(
    await management.revoke("workspace-a", "missing-key", "2026-09-16T00:00:00.000Z"),
    false
  );

  assert.equal(await management.revoke("workspace-a", keyA.id, "2026-09-16T00:00:00.000Z"), true);

  assert.deepEqual(await management.list("workspace-a", "2026-09-17T00:00:00.000Z"), [
    {
      id: keyA.id,
      name: "A",
      keyPrefix: "tku_AAAAAAAA",
      createdAt: "2026-09-10T00:00:00.000Z",
      expiresAt: null,
      revokedAt: "2026-09-16T00:00:00.000Z",
      lastUsedAt: null,
      status: "revoked",
    },
  ]);
});

test("workspace API-key management requires trusted workspace identity", async () => {
  const { management } = createHarness();

  await assert.rejects(
    management.create(" ", {
      name: "Invalid",
    }),
    /requires trusted workspace identity/
  );

  await assert.rejects(management.list(" "), /requires trusted workspace identity/);

  await assert.rejects(management.revoke(" ", "key-a"), /requires trusted workspace identity/);

  assert.equal(await management.revoke("workspace-a", " "), false);
});
