export type Retryability = "retryable" | "not-retryable" | "unknown";

export type CoreExecutionErrorCategory =
  | "authentication"
  | "authorization"
  | "rate-limit"
  | "invalid-request"
  | "unsupported"
  | "timeout"
  | "network"
  | "upstream-4xx"
  | "upstream-5xx"
  | "translation"
  | "cancelled"
  | "unknown";

export interface NormalizedExecutionError {
  readonly category: CoreExecutionErrorCategory;
  readonly code: string | null;
  readonly message: string;
  readonly upstreamStatus: number | null;
}
