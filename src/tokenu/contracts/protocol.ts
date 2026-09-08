/**
 * Canonical protocol vocabulary owned by TokenU.
 *
 * These values describe client/upstream wire protocols, not providers.
 * Provider identity and protocol identity are intentionally independent.
 */
export type TokenUProtocol = "openai" | "openai-responses" | "claude" | "gemini";

/**
 * Normalizes internal or legacy protocol aliases at the TokenU boundary.
 *
 * "openai-response" is an OmniRoute/internal legacy alias. It is not a
 * distinct TokenU protocol.
 */
export function normalizeTokenUProtocol(value: string): TokenUProtocol | null {
  if (value === "openai-response") {
    return "openai-responses";
  }

  switch (value) {
    case "openai":
    case "openai-responses":
    case "claude":
    case "gemini":
      return value;
    default:
      return null;
  }
}
