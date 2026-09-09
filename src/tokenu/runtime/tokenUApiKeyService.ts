import { randomUUID } from "node:crypto";

import type { TokenUApiKey } from "@/tokenu/contracts/tokenUApiKey";
import {
  generateTokenUApiKey,
  getTokenUApiKeyDisplayPrefix,
  hashTokenUApiKey,
  isTokenUApiKey,
} from "@/tokenu/runtime/tokenUApiKeyMaterial";
import type { TokenUApiKeyRepository } from "@/tokenu/runtime/tokenUApiKeyRepository";

export interface CreateTokenUApiKeyInput {
  readonly name: string;

  readonly expiresAt?: string | null;

  readonly createdAt?: string;
}

export interface CreatedTokenUApiKey {
  readonly id: string;

  readonly name: string;

  /**
   * Raw bearer material. This is deliberately returned only from create().
   * It must never be persisted.
   */
  readonly token: string;

  readonly keyPrefix: string;

  readonly createdAt: string;

  readonly expiresAt: string | null;
}

export interface TokenUApiKeyServiceOptions {
  readonly generateId?: () => string;

  readonly generateToken?: () => string;

  readonly now?: () => string;
}

function normalizeTimestamp(value: string, fieldName: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid TokenU API key ${fieldName}`);
  }

  return parsed.toISOString();
}

export class TokenUApiKeyService {
  private readonly generateId: () => string;

  private readonly generateToken: () => string;

  private readonly now: () => string;

  constructor(
    private readonly repository: TokenUApiKeyRepository,
    options: TokenUApiKeyServiceOptions = {}
  ) {
    this.generateId = options.generateId ?? randomUUID;
    this.generateToken = options.generateToken ?? generateTokenUApiKey;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async create(input: CreateTokenUApiKeyInput): Promise<CreatedTokenUApiKey> {
    const name = input.name.trim();

    if (!name) {
      throw new Error("TokenU API key requires name");
    }

    const id = this.generateId().trim();

    if (!id) {
      throw new Error("TokenU API key generator returned empty identity");
    }

    const token = this.generateToken();

    if (!isTokenUApiKey(token)) {
      throw new Error("TokenU API key generator returned invalid token");
    }

    const createdAt = normalizeTimestamp(input.createdAt ?? this.now(), "createdAt");

    const expiresAt =
      input.expiresAt === undefined || input.expiresAt === null
        ? null
        : normalizeTimestamp(input.expiresAt, "expiresAt");

    if (expiresAt !== null && Date.parse(expiresAt) <= Date.parse(createdAt)) {
      throw new Error("TokenU API key expiration must be after creation");
    }

    const keyPrefix = getTokenUApiKeyDisplayPrefix(token);
    const keyHash = hashTokenUApiKey(token);

    const apiKey: TokenUApiKey = {
      id,
      name,
      keyPrefix,
      keyHash,
      createdAt,
      expiresAt,
      revokedAt: null,
      lastUsedAt: null,
    };

    await this.repository.save(apiKey);

    return {
      id,
      name,
      token,
      keyPrefix,
      createdAt,
      expiresAt,
    };
  }

  async resolvePrincipalId(
    rawToken: string,
    verifiedAt: string = this.now()
  ): Promise<string | null> {
    if (!isTokenUApiKey(rawToken)) {
      return null;
    }

    const verifiedTimestamp = normalizeTimestamp(verifiedAt, "verifiedAt");

    const apiKey = await this.repository.getByHash(hashTokenUApiKey(rawToken));

    if (apiKey === null) {
      return null;
    }

    if (apiKey.revokedAt !== null) {
      return null;
    }

    if (
      apiKey.expiresAt !== null &&
      Date.parse(apiKey.expiresAt) <= Date.parse(verifiedTimestamp)
    ) {
      return null;
    }

    try {
      await this.repository.touchLastUsedAt(apiKey.id, verifiedTimestamp);
    } catch {
      // lastUsedAt is operational metadata, never an authentication gate.
    }

    return apiKey.id;
  }

  async revoke(apiKeyId: string, revokedAt: string = this.now()): Promise<boolean> {
    if (!apiKeyId.trim()) {
      return false;
    }

    const existing = await this.repository.getById(apiKeyId);

    if (existing === null) {
      return false;
    }

    if (existing.revokedAt !== null) {
      return true;
    }

    const normalizedRevokedAt = normalizeTimestamp(revokedAt, "revokedAt");

    await this.repository.save({
      ...existing,
      revokedAt: normalizedRevokedAt,
    });

    return true;
  }
}
