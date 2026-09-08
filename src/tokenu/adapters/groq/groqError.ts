import type { CoreExecutionErrorCategory, Retryability } from "@/tokenu/contracts/executionError";

export interface NormalizedGroqHttpError {
  readonly category: CoreExecutionErrorCategory;
  readonly code: string | null;
  readonly message: string;
  readonly retryability: Retryability;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseUpstreamErrorBody(bodyText: string): {
  code: string | null;
  message: string | null;
} {
  if (!bodyText) {
    return { code: null, message: null };
  }

  try {
    const parsed: unknown = JSON.parse(bodyText);
    const root = asRecord(parsed);
    const error = asRecord(root?.error);

    const rawCode = error?.code;
    const code =
      typeof rawCode === "string" || typeof rawCode === "number" ? String(rawCode) : null;

    const rawMessage = error?.message;
    const message =
      typeof rawMessage === "string" && rawMessage.trim().length > 0 ? rawMessage.trim() : null;

    return { code, message };
  } catch {
    return { code: null, message: null };
  }
}

export function normalizeGroqHttpError(status: number, bodyText: string): NormalizedGroqHttpError {
  const parsed = parseUpstreamErrorBody(bodyText);
  const message = parsed.message ?? `Groq request failed with HTTP ${status}.`;

  if (status === 400 || status === 422) {
    return {
      category: "invalid-request",
      code: parsed.code,
      message,
      retryability: "not-retryable",
    };
  }

  if (status === 401) {
    return {
      category: "authentication",
      code: parsed.code,
      message,
      retryability: "not-retryable",
    };
  }

  if (status === 403) {
    return {
      category: "authorization",
      code: parsed.code,
      message,
      retryability: "not-retryable",
    };
  }

  if (status === 404) {
    return {
      category: "unsupported",
      code: parsed.code,
      message,
      retryability: "not-retryable",
    };
  }

  if (status === 408) {
    return {
      category: "timeout",
      code: parsed.code,
      message,
      retryability: "retryable",
    };
  }

  if (status === 429) {
    return {
      category: "rate-limit",
      code: parsed.code,
      message,
      retryability: "retryable",
    };
  }

  if (status >= 500) {
    return {
      category: "upstream-5xx",
      code: parsed.code,
      message,
      retryability: "retryable",
    };
  }

  if (status >= 400) {
    return {
      category: "upstream-4xx",
      code: parsed.code,
      message,
      retryability: "not-retryable",
    };
  }

  return {
    category: "unknown",
    code: parsed.code,
    message,
    retryability: "unknown",
  };
}
