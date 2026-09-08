import type { TranslationContinuityScope } from "@/tokenu/contracts/continuityScope";
import type { TechnicalModelProfile } from "@/tokenu/contracts/model";
import type {
  ResolvedCachePolicy,
  ResolvedContinuityPolicy,
  ResolvedReasoningPolicy,
  ResolvedResponsesStatePolicy,
} from "@/tokenu/contracts/policy";
import type { TokenUProtocol } from "@/tokenu/contracts/protocol";
import type { RequestToolMetadata } from "@/tokenu/contracts/toolMetadata";

/**
 * Stable execution identity available to protocol translators.
 *
 * This scope contains identifiers only. It must never contain credentials,
 * provider tokens or mutable providerSpecificData.
 */
export interface TranslationExecutionScope {
  readonly requestId: string;
  readonly attemptId: string;
  readonly connectionId: string;
  readonly continuityScope: TranslationContinuityScope | null;
}

/**
 * Immutable context for one request-translation stage.
 *
 * Each stage gets its own context. Translators consume already-resolved
 * technical facts and policies; they do not infer them from provider/model
 * names, credentials, User-Agent, database settings or global mutable state.
 */
export interface RequestTranslationContext {
  readonly sourceProtocol: TokenUProtocol;
  readonly targetProtocol: TokenUProtocol;

  readonly providerId: string;
  readonly modelOfferingId: string;
  readonly upstreamModelId: string;

  readonly technicalModelProfile: TechnicalModelProfile;

  readonly responsesStatePolicy: ResolvedResponsesStatePolicy;
  readonly reasoningPolicy: ResolvedReasoningPolicy;
  readonly cachePolicy: ResolvedCachePolicy;
  readonly continuityPolicy: ResolvedContinuityPolicy;

  readonly executionScope: TranslationExecutionScope;
}

/**
 * Immutable context for one response-translation stage.
 *
 * Mutable parsing state is deliberately excluded. Every protocol stage and
 * every upstream attempt creates its own dedicated response-state object.
 */
export interface ResponseTranslationContext {
  readonly sourceProtocol: TokenUProtocol;
  readonly targetProtocol: TokenUProtocol;

  readonly providerId: string;
  readonly modelOfferingId: string;
  readonly upstreamModelId: string;

  readonly technicalModelProfile: TechnicalModelProfile;

  /**
   * Request-derived tool metadata needed to reconstruct client-visible tool
   * calls without hidden payload markers or mutable shared state.
   */
  readonly toolMetadata: RequestToolMetadata;

  /**
   * Resolved reasoning behavior needed to interpret upstream reasoning output.
   */
  readonly reasoningPolicy: ResolvedReasoningPolicy;

  readonly executionScope: TranslationExecutionScope;
}
