import type { JsonValue } from "@/tokenu/contracts/json";
import type { RequestProtocolTranslator } from "@/tokenu/contracts/protocolTranslator";
import type { TokenUProtocol } from "@/tokenu/contracts/protocol";
import type { ResponseTranslationContext } from "@/tokenu/contracts/translationContext";
import type { TranslationOutcome } from "@/tokenu/contracts/translationOutcome";

/**
 * Bound response-translation session for exactly one stage and one attempt.
 *
 * Protocol-specific mutable state is encapsulated inside the session and is
 * never exposed through the registry boundary.
 */
export interface ResponseTranslationSession {
  readonly translatorId: string;
  readonly sourceProtocol: TokenUProtocol;
  readonly targetProtocol: TokenUProtocol;

  translateResponseChunk(chunk: JsonValue): TranslationOutcome;

  flushResponse(): TranslationOutcome;
}

/**
 * Approved response-translator registration.
 *
 * Implementations may internally use ResponseProtocolTranslator<TState>, but
 * TState remains private to the created session.
 */
export interface ResponseProtocolTranslatorRegistration {
  readonly id: string;
  readonly sourceProtocol: TokenUProtocol;
  readonly targetProtocol: TokenUProtocol;

  createSession(context: ResponseTranslationContext): ResponseTranslationSession;
}

/**
 * Fail-closed registry of explicitly approved protocol directions.
 *
 * Missing directions resolve to null. The registry must never infer a
 * translator, silently select another protocol, or construct a hub fallback.
 * Direct-vs-hub path selection belongs to the translation pipeline.
 */
export interface ProtocolTranslatorRegistry {
  resolveRequest(
    sourceProtocol: TokenUProtocol,
    targetProtocol: TokenUProtocol
  ): RequestProtocolTranslator | null;

  resolveResponse(
    sourceProtocol: TokenUProtocol,
    targetProtocol: TokenUProtocol
  ): ResponseProtocolTranslatorRegistration | null;
}
