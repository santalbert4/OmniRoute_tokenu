import assert from "node:assert/strict";
import test from "node:test";

import { AesGcmCredentialCipher } from "@/tokenu/adapters/security/aesGcmCredentialCipher";
import type { TokenUProviderConnection } from "@/tokenu/contracts/providerConnection";
import { PersistentSecretResolver } from "@/tokenu/runtime/persistentSecretResolver";
import type { ProviderConnectionRepository } from "@/tokenu/runtime/providerConnectionRepository";
import { ProviderConnectionService } from "@/tokenu/runtime/providerConnectionService";

class MemoryRepository implements ProviderConnectionRepository {
  private readonly records = new Map<string, TokenUProviderConnection>();

  async get(connectionId: string): Promise<TokenUProviderConnection | null> {
    return this.records.get(connectionId) ?? null;
  }

  async save(connection: TokenUProviderConnection): Promise<void> {
    this.records.set(connection.id, connection);
  }
}

const masterKey = "tokenu-test-master-key-0123456789abcdef";

test("provider connection service encrypts before persistence and resolver decrypts just in time", async () => {
  const repository = new MemoryRepository();

  const cipher = new AesGcmCredentialCipher(masterKey);

  const service = new ProviderConnectionService(repository, cipher);

  await service.saveManagedCredential({
    connectionId: "groq-managed",
    providerId: "groq",
    credentialKind: "api-key",
    plaintextCredential: "gsk_test_secret",
    enabled: true,
    recordedAt: "2026-09-09T00:00:00.000Z",
  });

  const stored = await repository.get("groq-managed");

  assert.ok(stored);

  assert.match(stored.encryptedCredential, /^tokenu:cred:v1:/);

  assert.equal(stored.encryptedCredential.includes("gsk_test_secret"), false);

  const resolver = new PersistentSecretResolver(repository, cipher);

  assert.deepEqual(await resolver.resolve("groq-managed"), {
    kind: "api-key",
    value: "gsk_test_secret",
  });
});

test("persistent secret resolver fails closed for missing disabled or undecryptable connections", async () => {
  const repository = new MemoryRepository();

  const cipher = new AesGcmCredentialCipher(masterKey);

  const resolver = new PersistentSecretResolver(repository, cipher);

  assert.equal(await resolver.resolve("missing"), null);

  await repository.save({
    id: "disabled",
    providerId: "groq",
    credentialMode: "TOKENU_MANAGED",
    credentialKind: "api-key",
    encryptedCredential: cipher.encrypt("secret", {
      connectionId: "disabled",
      providerId: "groq",
      credentialMode: "TOKENU_MANAGED",
      credentialKind: "api-key",
    }),
    enabled: false,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
  });

  assert.equal(await resolver.resolve("disabled"), null);

  await repository.save({
    id: "corrupt",
    providerId: "groq",
    credentialMode: "TOKENU_MANAGED",
    credentialKind: "api-key",
    encryptedCredential: "tokenu:cred:v1:corrupt",
    enabled: true,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
  });

  assert.equal(await resolver.resolve("corrupt"), null);
});

test("persistent secret resolver performs exact connection lookup without fallback", async () => {
  const repository = new MemoryRepository();

  const cipher = new AesGcmCredentialCipher(masterKey);

  const service = new ProviderConnectionService(repository, cipher);

  await service.saveManagedCredential({
    connectionId: "groq-a",
    providerId: "groq",
    credentialKind: "api-key",
    plaintextCredential: "secret-a",
    enabled: true,
    recordedAt: "2026-09-09T00:00:00.000Z",
  });

  const resolver = new PersistentSecretResolver(repository, cipher);

  assert.equal(await resolver.resolve("groq"), null);

  assert.equal(await resolver.resolve("groq-b"), null);

  assert.deepEqual(await resolver.resolve("groq-a"), {
    kind: "api-key",
    value: "secret-a",
  });
});

test("provider connection service preserves original createdAt during credential rotation", async () => {
  const repository = new MemoryRepository();

  const cipher = new AesGcmCredentialCipher(masterKey);

  const service = new ProviderConnectionService(repository, cipher);

  await service.saveManagedCredential({
    connectionId: "groq-managed",
    providerId: "groq",
    credentialKind: "api-key",
    plaintextCredential: "secret-a",
    enabled: true,
    recordedAt: "2026-09-09T00:00:00.000Z",
  });

  await service.saveManagedCredential({
    connectionId: "groq-managed",
    providerId: "groq",
    credentialKind: "api-key",
    plaintextCredential: "secret-b",
    enabled: true,
    recordedAt: "2026-09-10T00:00:00.000Z",
  });

  const stored = await repository.get("groq-managed");

  assert.equal(stored?.createdAt, "2026-09-09T00:00:00.000Z");

  assert.equal(stored?.updatedAt, "2026-09-10T00:00:00.000Z");

  const resolver = new PersistentSecretResolver(repository, cipher);

  assert.deepEqual(await resolver.resolve("groq-managed"), {
    kind: "api-key",
    value: "secret-b",
  });
});
