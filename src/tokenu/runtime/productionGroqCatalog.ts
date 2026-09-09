import type { ModelOffering } from "@/tokenu/contracts/offering";
import type { ProviderPricing } from "@/tokenu/contracts/providerPricing";
import type { TechnicalModelProfile } from "@/tokenu/contracts/model";
import {
  GROQ_ADAPTER_ID,
  GROQ_OFFICIAL_CHAT_COMPLETIONS_URL,
} from "@/tokenu/adapters/groq/groqAdapterFactory";
import type { EndpointProfile } from "@/tokenu/runtime/endpointProfileRegistry";
import type { ApprovedExecutionRoute } from "@/tokenu/runtime/publicExecutionRouteRegistry";

export const GROQ_PROVIDER_ID = "groq";

export const GROQ_MANAGED_CONNECTION_ID = "groq-managed";

export const GROQ_CHAT_COMPLETIONS_ENDPOINT_PROFILE_ID = "groq-official-chat-completions";

export const GROQ_GPT_OSS_20B_PUBLIC_MODEL_ID = "gpt-oss-20b";

export const GROQ_GPT_OSS_20B_CANONICAL_MODEL_ID = "gpt-oss-20b";

export const GROQ_GPT_OSS_20B_UPSTREAM_MODEL_ID = "openai/gpt-oss-20b";

export const GROQ_GPT_OSS_20B_OFFERING_ID = "groq:openai/gpt-oss-20b";

export const GROQ_GPT_OSS_20B_TECHNICAL_PROFILE_ID = "groq-gpt-oss-20b-profile";

/**
 * First date on which this exact upstream price was reviewed for TokenU.
 *
 * TokenU does not backdate provider pricing to an unverified historical
 * effective date.
 */
export const GROQ_GPT_OSS_20B_PRICING_EFFECTIVE_FROM = "2026-09-09T00:00:00.000Z";

export const GROQ_CHAT_COMPLETIONS_ENDPOINT_PROFILE: EndpointProfile = Object.freeze({
  id: GROQ_CHAT_COMPLETIONS_ENDPOINT_PROFILE_ID,
  url: GROQ_OFFICIAL_CHAT_COMPLETIONS_URL,
});

/**
 * Reviewed Groq GPT-OSS 20B technical profile.
 *
 * Provider-integrated browser/code tools are intentionally not represented as
 * supported TokenU capabilities in P6H. Only ordinary function tools cross the
 * reviewed Groq adapter boundary.
 */
export const GROQ_GPT_OSS_20B_TECHNICAL_PROFILE: TechnicalModelProfile = Object.freeze({
  id: GROQ_GPT_OSS_20B_TECHNICAL_PROFILE_ID,
  upstreamProtocol: "openai",
  contextWindowTokens: 131_072,
  maxOutputTokens: 65_536,
  capabilities: Object.freeze({
    streaming: "supported",
    toolCalling: "supported",
    visionInput: "unsupported",
    audioInput: "unsupported",
    audioOutput: "unsupported",
    structuredOutput: "supported",
    jsonSchema: "supported",
    webSearch: "unknown",
  }),
  reasoning: Object.freeze({
    support: "supported",
    transport: "native",
    supportedEfforts: Object.freeze(["low", "medium", "high"]),
  }),
  toolNameMaxLength: null,

  /**
   * Explicit OpenAI-compatible fields that TokenU does not allow on this
   * reviewed route.
   *
   * Some are unsupported by Groq; others are provider-specific commercial,
   * identity or built-in-tool controls that public TokenU callers must not
   * select directly.
   */
  unsupportedParameters: Object.freeze([
    "frequency_penalty",
    "presence_penalty",
    "logprobs",
    "logit_bias",
    "top_logprobs",
    "metadata",
    "store",
    "service_tier",
    "documents",
    "search_settings",
    "citation_options",
    "compound_custom",
    "disable_tool_validation",
    "include_domains",
    "exclude_domains",
    "user",
  ]),
  requestTimeoutMs: null,
});

export const GROQ_GPT_OSS_20B_OFFERING: ModelOffering = Object.freeze({
  id: GROQ_GPT_OSS_20B_OFFERING_ID,
  providerId: GROQ_PROVIDER_ID,
  canonicalModelId: GROQ_GPT_OSS_20B_CANONICAL_MODEL_ID,
  upstreamModelId: GROQ_GPT_OSS_20B_UPSTREAM_MODEL_ID,
  technicalProfileId: GROQ_GPT_OSS_20B_TECHNICAL_PROFILE_ID,
  credentialModes: Object.freeze(["TOKENU_MANAGED"] as const),
  commercialStatus: "production-approved",
  availability: "available",
  serviceRegions: Object.freeze([]),
  pricing: Object.freeze({
    currency: "USD",
    unit: "per-million-tokens",
    input: 0.075,
    output: 0.3,
    cacheRead: 0.037,
    cacheWrite: null,
  }),
});

export const GROQ_GPT_OSS_20B_ROUTE: ApprovedExecutionRoute = Object.freeze({
  publicModelId: GROQ_GPT_OSS_20B_PUBLIC_MODEL_ID,
  offering: GROQ_GPT_OSS_20B_OFFERING,
  credentialMode: "TOKENU_MANAGED",
  connectionId: GROQ_MANAGED_CONNECTION_ID,
  adapterId: GROQ_ADAPTER_ID,
  endpointProfileId: GROQ_CHAT_COMPLETIONS_ENDPOINT_PROFILE_ID,
  serviceRegion: null,
});

/**
 * Historical billing key intentionally uses upstreamModelId because execution
 * billing and usage projections record target.upstreamModelId.
 */
export const GROQ_GPT_OSS_20B_PROVIDER_PRICING: ProviderPricing = Object.freeze({
  providerId: GROQ_PROVIDER_ID,
  modelId: GROQ_GPT_OSS_20B_UPSTREAM_MODEL_ID,
  currency: "USD",
  inputTokenPricePerMillion: 0.075,
  outputTokenPricePerMillion: 0.3,
  cacheReadTokenPricePerMillion: 0.037,
  cacheWriteTokenPricePerMillion: null,
  effectiveFrom: GROQ_GPT_OSS_20B_PRICING_EFFECTIVE_FROM,
});

export const PRODUCTION_GROQ_ENDPOINT_PROFILES = Object.freeze([
  GROQ_CHAT_COMPLETIONS_ENDPOINT_PROFILE,
]);

export const PRODUCTION_GROQ_TECHNICAL_MODEL_PROFILES = Object.freeze([
  GROQ_GPT_OSS_20B_TECHNICAL_PROFILE,
]);

export const PRODUCTION_GROQ_PUBLIC_EXECUTION_ROUTES = Object.freeze([GROQ_GPT_OSS_20B_ROUTE]);

export const PRODUCTION_GROQ_PROVIDER_PRICING = Object.freeze([GROQ_GPT_OSS_20B_PROVIDER_PRICING]);
