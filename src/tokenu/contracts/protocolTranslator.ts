import type { JsonValue } from "@/tokenu/contracts/json";
import type {
  RequestTranslationContext,
  ResponseTranslationContext,
} from "@/tokenu/contracts/translationContext";
import type { TranslationOutcome } from "@/tokenu/contracts/translationOutcome";
import type { TokenUProtocol } from "@/tokenu/contracts/protocol";
import type { RequestToolMetadata } from "@/tokenu/contracts/toolMetadata";

/**
 * Explicit result of one request-translation stage.
 *
 * Request-derived metadata travels beside the provider payload instead of
 * being hidden inside it through properties such as _toolNameMap.
 */
export interface RequestTranslationResult {
  readonly payload: JsonValue;
  readonly toolMetadata: RequestToolMetadata;
}

/**
 * One explicitly approved request translation direction.
 */
export interface RequestProtocolTranslator {
  readonly id: string;
  readonly sourceProtocol: TokenUProtocol;
  readonly targetProtocol: TokenUProtocol;

  translateRequest(
    payload: JsonValue,
    context: RequestTranslationContext
  ): RequestTranslationResult;
}

/**
 * One explicitly approved response translation direction.
 *
 * TState is mutable protocol-specific parser state. A fresh instance must be
 * created for every translation stage and every upstream attempt.
 */
export interface ResponseProtocolTranslator<TState extends object> {
  readonly id: string;
  readonly sourceProtocol: TokenUProtocol;
  readonly targetProtocol: TokenUProtocol;

  createState(context: ResponseTranslationContext): TState;

  translateResponseChunk(
    chunk: JsonValue,
    state: TState,
    context: ResponseTranslationContext
  ): TranslationOutcome;

  flushResponse(state: TState, context: ResponseTranslationContext): TranslationOutcome;
}
