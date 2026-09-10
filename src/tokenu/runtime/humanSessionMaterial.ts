import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const TOKENU_HUMAN_SESSION_PREFIX = "tks_";
export const TOKENU_HUMAN_SESSION_SECRET_BYTES = 32;

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SECRET_HASH_PATTERN = /^[0-9a-f]{64}$/;

export interface ParsedHumanSessionCredential {
  readonly sessionId: string;
  readonly secret: string;
}

export function generateHumanSessionSecret(): string {
  return randomBytes(TOKENU_HUMAN_SESSION_SECRET_BYTES).toString("base64url");
}

export function isHumanSessionSecretHash(value: string): boolean {
  return SECRET_HASH_PATTERN.test(value);
}

export function hashHumanSessionSecret(secret: string): string {
  if (!SECRET_PATTERN.test(secret)) {
    throw new Error("Invalid human session secret material");
  }

  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function formatHumanSessionCredential(sessionId: string, secret: string): string {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error("Invalid human session identity");
  }

  if (!SECRET_PATTERN.test(secret)) {
    throw new Error("Invalid human session secret material");
  }

  return `${TOKENU_HUMAN_SESSION_PREFIX}${sessionId}.${secret}`;
}

export function parseHumanSessionCredential(
  credential: string
): ParsedHumanSessionCredential | null {
  const match = credential.match(/^tks_([A-Za-z0-9_-]{1,128})\.([A-Za-z0-9_-]{43})$/);

  if (!match) {
    return null;
  }

  return {
    sessionId: match[1],
    secret: match[2],
  };
}

export function verifyHumanSessionSecret(secret: string, expectedHash: string): boolean {
  if (!SECRET_PATTERN.test(secret) || !SECRET_HASH_PATTERN.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(hashHumanSessionSecret(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
