import type { TokenUProtocol } from "@/tokenu/contracts/protocol";

/**
 * TokenU never infers a required capability from a model name.
 *
 * "unknown" is intentionally distinct from "unsupported":
 * required capabilities fail closed when support is unknown.
 */
export type CapabilitySupport = "supported" | "unsupported" | "unknown";

export type ReasoningTransport = "none" | "native" | "textual-tags" | "opaque-state";

export interface TechnicalModelCapabilities {
  readonly streaming: CapabilitySupport;
  readonly toolCalling: CapabilitySupport;
  readonly visionInput: CapabilitySupport;
  readonly audioInput: CapabilitySupport;
  readonly audioOutput: CapabilitySupport;
  readonly structuredOutput: CapabilitySupport;
  readonly jsonSchema: CapabilitySupport;
  readonly webSearch: CapabilitySupport;
}

export type TechnicalReasoningProfile =
  | {
      readonly support: "unsupported" | "unknown";
      readonly transport: "none";
      readonly supportedEfforts: readonly [];
    }
  | {
      readonly support: "supported";
      readonly transport: Exclude<ReasoningTransport, "none">;
      readonly supportedEfforts: readonly string[];
    };

/**
 * Reviewed technical behavior for one exact upstream model offering.
 *
 * This contract contains protocol and capability facts only.
 * Commercial eligibility, pricing, provider health, credentials and
 * TokenScore inputs belong elsewhere.
 */
export interface TechnicalModelProfile {
  readonly id: string;
  readonly upstreamProtocol: TokenUProtocol;
  readonly contextWindowTokens: number | null;
  readonly maxOutputTokens: number | null;
  readonly capabilities: TechnicalModelCapabilities;
  readonly reasoning: TechnicalReasoningProfile;
  readonly toolNameMaxLength: number | null;
  readonly unsupportedParameters: readonly string[];
  readonly requestTimeoutMs: number | null;
}
