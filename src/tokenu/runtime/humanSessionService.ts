import { randomUUID } from "node:crypto";

import type { AuthenticatedTokenUUser } from "@/tokenu/contracts/humanAuthenticationIdentity";
import type { CreatedHumanSession, TokenUHumanSession } from "@/tokenu/contracts/humanSession";
import {
  formatHumanSessionCredential,
  generateHumanSessionSecret,
  hashHumanSessionSecret,
  isHumanSessionSecretHash,
  parseHumanSessionCredential,
  verifyHumanSessionSecret,
} from "@/tokenu/runtime/humanSessionMaterial";
import type { HumanSessionRepository } from "@/tokenu/runtime/humanSessionRepository";
import type { TokenUUserRepository } from "@/tokenu/runtime/tokenUUserRepository";

export interface CreateHumanSessionInput {
  readonly userId: string;
  readonly expiresAt: string;
  readonly createdAt?: string;
}

export interface HumanSessionServiceOptions {
  readonly now?: () => string;
  readonly generateId?: () => string;
  readonly generateSecret?: () => string;
}

function normalizeRequiredIdentity(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`Human session requires ${label}`);
  }

  return normalized;
}

function normalizeTimestamp(value: string, label: string): string {
  if (!value.trim()) {
    throw new Error(`Human session requires ${label}`);
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Human session has invalid ${label}`);
  }

  return new Date(timestamp).toISOString();
}

function parseStoredTimestamp(value: string, label: string): number {
  if (!value.trim()) {
    throw new Error(`Invalid human session ${label}`);
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid human session ${label}`);
  }

  return timestamp;
}

function assertStoredSessionIntegrity(
  session: TokenUHumanSession,
  expectedSessionId?: string
): void {
  if (!session.id.trim()) {
    throw new Error("Invalid human session identity");
  }

  if (expectedSessionId !== undefined && session.id !== expectedSessionId) {
    throw new Error("Human session lookup returned a different identity");
  }

  if (!session.userId.trim()) {
    throw new Error("Invalid human session user identity");
  }

  if (!isHumanSessionSecretHash(session.secretHash)) {
    throw new Error("Invalid human session secret hash");
  }

  const createdAt = parseStoredTimestamp(session.createdAt, "creation timestamp");
  const expiresAt = parseStoredTimestamp(session.expiresAt, "expiry timestamp");

  if (expiresAt <= createdAt) {
    throw new Error("Invalid human session lifetime");
  }

  if (session.revokedAt !== null) {
    const revokedAt = parseStoredTimestamp(session.revokedAt, "revocation timestamp");

    if (revokedAt < createdAt) {
      throw new Error("Invalid human session revocation timestamp");
    }
  }
}

export class HumanSessionService {
  private readonly now: () => string;
  private readonly generateId: () => string;
  private readonly generateSecret: () => string;

  constructor(
    private readonly sessions: HumanSessionRepository,
    private readonly users: TokenUUserRepository,
    options: HumanSessionServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.generateId = options.generateId ?? randomUUID;
    this.generateSecret = options.generateSecret ?? generateHumanSessionSecret;
  }

  async create(input: CreateHumanSessionInput): Promise<CreatedHumanSession> {
    const userId = normalizeRequiredIdentity(input.userId, "TokenU user identity");

    const user = await this.users.get(userId);

    if (!user) {
      throw new Error("Human session references missing TokenU user");
    }

    if (user.id !== userId) {
      throw new Error("TokenU user lookup returned a different identity");
    }

    const createdAt = normalizeTimestamp(input.createdAt ?? this.now(), "creation timestamp");
    const expiresAt = normalizeTimestamp(input.expiresAt, "expiry timestamp");

    if (Date.parse(expiresAt) <= Date.parse(createdAt)) {
      throw new Error("Human session expiry must be after creation");
    }

    const id = normalizeRequiredIdentity(this.generateId(), "identity");

    if (await this.sessions.get(id)) {
      throw new Error("Human session identity collision");
    }

    const secret = this.generateSecret();
    const credential = formatHumanSessionCredential(id, secret);
    const secretHash = hashHumanSessionSecret(secret);

    const session: TokenUHumanSession = {
      id,
      userId,
      secretHash,
      createdAt,
      expiresAt,
      revokedAt: null,
    };

    await this.sessions.create(session);

    return {
      session,
      credential,
    };
  }

  async authenticate(
    credential: string,
    evaluatedAt: string = this.now()
  ): Promise<AuthenticatedTokenUUser | null> {
    const parsed = parseHumanSessionCredential(credential);

    if (!parsed) {
      return null;
    }

    const session = await this.sessions.get(parsed.sessionId);

    if (!session) {
      return null;
    }

    assertStoredSessionIntegrity(session, parsed.sessionId);

    if (!verifyHumanSessionSecret(parsed.secret, session.secretHash)) {
      return null;
    }

    if (session.revokedAt !== null) {
      return null;
    }

    const evaluatedTimestamp = Date.parse(normalizeTimestamp(evaluatedAt, "evaluation timestamp"));

    if (Date.parse(session.expiresAt) <= evaluatedTimestamp) {
      return null;
    }

    const user = await this.users.get(session.userId);

    if (!user) {
      throw new Error("Human session references missing TokenU user");
    }

    if (user.id !== session.userId) {
      throw new Error("TokenU user lookup returned a different identity");
    }

    return {
      userId: session.userId,
    };
  }

  async revoke(sessionId: string, revokedAt: string = this.now()): Promise<boolean> {
    const normalizedSessionId = sessionId.trim();

    if (!normalizedSessionId) {
      return false;
    }

    const existing = await this.sessions.get(normalizedSessionId);

    if (!existing) {
      return false;
    }

    assertStoredSessionIntegrity(existing, normalizedSessionId);

    if (existing.revokedAt !== null) {
      return true;
    }

    const normalizedRevokedAt = normalizeTimestamp(revokedAt, "revocation timestamp");

    if (Date.parse(normalizedRevokedAt) < Date.parse(existing.createdAt)) {
      throw new Error("Human session revocation cannot predate creation");
    }

    return this.sessions.revoke(normalizedSessionId, normalizedRevokedAt);
  }
}
