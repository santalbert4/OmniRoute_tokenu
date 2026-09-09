import { createHash, randomBytes } from "node:crypto";

const TOKENU_API_KEY_PREFIX = "tku_";
const TOKENU_API_KEY_SECRET_BYTES = 32;
const TOKENU_API_KEY_ENCODED_SECRET_LENGTH = 43;
const TOKENU_API_KEY_DISPLAY_PREFIX_LENGTH = 12;

const TOKENU_API_KEY_PATTERN = new RegExp(
  `^${TOKENU_API_KEY_PREFIX}[A-Za-z0-9_-]{${TOKENU_API_KEY_ENCODED_SECRET_LENGTH}}$`
);

/**
 * Generate 256 bits of cryptographically secure bearer-key entropy.
 *
 * The raw token must be returned only at creation time and must never be persisted.
 */
export function generateTokenUApiKey(): string {
  const secret = randomBytes(TOKENU_API_KEY_SECRET_BYTES).toString("base64url");

  if (secret.length !== TOKENU_API_KEY_ENCODED_SECRET_LENGTH) {
    throw new Error("Unexpected TokenU API key encoding length");
  }

  return `${TOKENU_API_KEY_PREFIX}${secret}`;
}

export function isTokenUApiKey(value: string): boolean {
  return TOKENU_API_KEY_PATTERN.test(value);
}

/**
 * Deterministic lookup digest for high-entropy TokenU-generated API keys.
 *
 * This is credential lookup hashing, not password hashing. Raw TokenU keys
 * contain 256 bits of cryptographically secure random entropy.
 */
export function hashTokenUApiKey(rawToken: string): string {
  if (!isTokenUApiKey(rawToken)) {
    throw new Error("Invalid TokenU API key format");
  }

  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function getTokenUApiKeyDisplayPrefix(rawToken: string): string {
  if (!isTokenUApiKey(rawToken)) {
    throw new Error("Invalid TokenU API key format");
  }

  return rawToken.slice(0, TOKENU_API_KEY_DISPLAY_PREFIX_LENGTH);
}
