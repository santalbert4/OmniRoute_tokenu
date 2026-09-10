import assert from "node:assert/strict";
import test from "node:test";

import type { TokenUHumanSession } from "@/tokenu/contracts/humanSession";
import type { TokenUUser } from "@/tokenu/contracts/humanControlPlaneIdentity";
import { hashHumanSessionSecret } from "@/tokenu/runtime/humanSessionMaterial";
import type { HumanSessionRepository } from "@/tokenu/runtime/humanSessionRepository";
import { HumanSessionService } from "@/tokenu/runtime/humanSessionService";
import type { TokenUUserRepository } from "@/tokenu/runtime/tokenUUserRepository";

class FakeSessionRepository implements HumanSessionRepository {
  readonly rows = new Map<string, TokenUHumanSession>();

  async get(sessionId: string): Promise<TokenUHumanSession | null> {
    return this.rows.get(sessionId) ?? null;
  }

  async create(session: TokenUHumanSession): Promise<void> {
    if (this.rows.has(session.id)) {
      throw new Error("duplicate session");
    }

    this.rows.set(session.id, session);
  }

  async revoke(sessionId: string, revokedAt: string): Promise<boolean> {
    const current = this.rows.get(sessionId);

    if (!current) {
      return false;
    }

    if (current.revokedAt !== null) {
      return true;
    }

    this.rows.set(sessionId, {
      ...current,
      revokedAt,
    });

    return true;
  }
}

class FakeUserRepository implements TokenUUserRepository {
  readonly rows = new Map<string, TokenUUser>();
  getCalls = 0;
  saveCalls = 0;

  async get(userId: string): Promise<TokenUUser | null> {
    this.getCalls += 1;
    return this.rows.get(userId) ?? null;
  }

  async save(): Promise<void> {
    this.saveCalls += 1;
    throw new Error("unexpected user provisioning");
  }
}

function fixture() {
  const sessions = new FakeSessionRepository();
  const users = new FakeUserRepository();

  users.rows.set("user-a", {
    id: "user-a",
    createdAt: "2026-09-10T00:00:00.000Z",
  });

  const service = new HumanSessionService(sessions, users, {
    now: () => "2026-09-10T12:00:00.000Z",
    generateId: () => "session-a",
    generateSecret: () => "S".repeat(43),
  });

  return {
    sessions,
    users,
    service,
  };
}

test("human session creation stores only hash and returns raw bearer separately", async () => {
  const { sessions, users, service } = fixture();

  const result = await service.create({
    userId: "user-a",
    createdAt: "2026-09-10T12:00:00.000Z",
    expiresAt: "2026-09-11T12:00:00.000Z",
  });

  assert.equal(result.credential, `tks_session-a.${"S".repeat(43)}`);

  assert.deepEqual(result.session, {
    id: "session-a",
    userId: "user-a",
    secretHash: hashHumanSessionSecret("S".repeat(43)),
    createdAt: "2026-09-10T12:00:00.000Z",
    expiresAt: "2026-09-11T12:00:00.000Z",
    revokedAt: null,
  });

  assert.equal(JSON.stringify(sessions.rows.get("session-a")).includes("S".repeat(43)), false);

  assert.equal(users.saveCalls, 0);
});

test("human session creation rejects missing TokenU users without provisioning", async () => {
  const { users, service } = fixture();

  await assert.rejects(
    service.create({
      userId: "missing-user",
      expiresAt: "2026-09-11T12:00:00.000Z",
    }),
    /missing TokenU user/
  );

  assert.equal(users.saveCalls, 0);
});

test("human session creation requires expiry after creation", async () => {
  const { service } = fixture();

  await assert.rejects(
    service.create({
      userId: "user-a",
      createdAt: "2026-09-10T12:00:00.000Z",
      expiresAt: "2026-09-10T12:00:00.000Z",
    }),
    /expiry must be after creation/
  );
});

test("valid human session authenticates to internal TokenU user only", async () => {
  const { service } = fixture();

  const created = await service.create({
    userId: "user-a",
    expiresAt: "2026-09-11T12:00:00.000Z",
  });

  assert.deepEqual(await service.authenticate(created.credential, "2026-09-10T13:00:00.000Z"), {
    userId: "user-a",
  });
});

test("malformed, unknown and wrong-secret credentials fail closed", async () => {
  const { service } = fixture();

  const created = await service.create({
    userId: "user-a",
    expiresAt: "2026-09-11T12:00:00.000Z",
  });

  assert.equal(await service.authenticate("bad"), null);
  assert.equal(await service.authenticate(`tks_unknown.${"U".repeat(43)}`), null);
  assert.equal(await service.authenticate(`tks_session-a.${"W".repeat(43)}`), null);

  assert.ok(created.credential);
});

test("expired human sessions fail closed", async () => {
  const { service } = fixture();

  const created = await service.create({
    userId: "user-a",
    createdAt: "2026-09-10T12:00:00.000Z",
    expiresAt: "2026-09-10T13:00:00.000Z",
  });

  assert.equal(await service.authenticate(created.credential, "2026-09-10T13:00:00.000Z"), null);
});

test("revoked human sessions fail closed and revocation is idempotent", async () => {
  const { sessions, service } = fixture();

  const created = await service.create({
    userId: "user-a",
    expiresAt: "2026-09-11T12:00:00.000Z",
  });

  assert.equal(await service.revoke("session-a", "2026-09-10T13:00:00.000Z"), true);

  const firstRevocation = sessions.rows.get("session-a")?.revokedAt;

  assert.equal(await service.revoke("session-a", "2026-09-10T14:00:00.000Z"), true);

  assert.equal(sessions.rows.get("session-a")?.revokedAt, firstRevocation);

  assert.equal(await service.authenticate(created.credential, "2026-09-10T14:00:00.000Z"), null);
});

test("unknown human session revocation returns false", async () => {
  const { service } = fixture();

  assert.equal(await service.revoke("unknown"), false);
});

test("dangling human session user fails closed as integrity error", async () => {
  const { sessions, users, service } = fixture();

  const created = await service.create({
    userId: "user-a",
    expiresAt: "2026-09-11T12:00:00.000Z",
  });

  users.rows.delete("user-a");

  await assert.rejects(service.authenticate(created.credential), /missing TokenU user/);

  assert.ok(sessions.rows.has("session-a"));
});

test("session repository cannot silently return a different identity", async () => {
  const { sessions, service } = fixture();

  const created = await service.create({
    userId: "user-a",
    expiresAt: "2026-09-11T12:00:00.000Z",
  });

  const stored = sessions.rows.get("session-a");
  assert.ok(stored);

  sessions.get = async () => ({
    ...stored,
    id: "session-b",
  });

  await assert.rejects(service.authenticate(created.credential), /different identity/);
});
