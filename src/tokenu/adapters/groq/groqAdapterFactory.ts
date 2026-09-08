import type {
  SingleTargetAdapterBinding,
  SingleTargetAdapterBindingResult,
  SingleTargetAdapterFactory,
} from "@/tokenu/runtime/adapterRegistry";
import { GroqSingleTargetAdapter } from "@/tokenu/adapters/groq/groqSingleTargetAdapter";

export const GROQ_ADAPTER_ID = "groq-official-openai-v1";

export const GROQ_OFFICIAL_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqAdapterFactoryOptions {
  readonly fetchImpl?: typeof fetch;
}

/**
 * Fail-closed factory for the official Groq OpenAI-compatible endpoint.
 *
 * Endpoint, target, credential and technical profile are already resolved by
 * trusted TokenU runtime layers. No provider/model/credential inference occurs here.
 */
export class GroqAdapterFactory implements SingleTargetAdapterFactory {
  readonly id = GROQ_ADAPTER_ID;

  private readonly fetchImpl: typeof fetch;

  constructor(options: GroqAdapterFactoryOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  bind(binding: SingleTargetAdapterBinding): SingleTargetAdapterBindingResult {
    if (binding.target.providerId !== "groq" || binding.target.adapterId !== this.id) {
      return {
        ok: false,
        error: {
          code: "target-not-supported",
          message: "This adapter factory supports official Groq targets only.",
        },
      };
    }

    if (
      binding.target.endpointProfileId !== binding.endpoint.id ||
      binding.endpoint.url !== GROQ_OFFICIAL_CHAT_COMPLETIONS_URL
    ) {
      return {
        ok: false,
        error: {
          code: "endpoint-not-supported",
          message: "The Groq adapter accepts only the approved official Chat Completions endpoint.",
        },
      };
    }

    if (binding.credential.kind !== "api-key" || binding.credential.value.trim().length === 0) {
      return {
        ok: false,
        error: {
          code: "credential-not-supported",
          message: "Official Groq execution requires a non-empty API key.",
        },
      };
    }

    if (
      binding.target.technicalProfileId !== binding.technicalModelProfile.id ||
      binding.technicalModelProfile.upstreamProtocol !== "openai"
    ) {
      return {
        ok: false,
        error: {
          code: "technical-profile-not-supported",
          message: "Groq Phase 2.9A requires a matching OpenAI technical model profile.",
        },
      };
    }

    if (
      binding.target.upstreamModelId.trim().length === 0 ||
      binding.target.serviceRegion !== null
    ) {
      return {
        ok: false,
        error: {
          code: "invalid-binding",
          message:
            "The Groq binding must contain a model identifier and no service-region override.",
        },
      };
    }

    return {
      ok: true,
      adapter: new GroqSingleTargetAdapter(binding, this.fetchImpl),
    };
  }
}
