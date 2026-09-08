import type { TranslationContinuityScope } from "@/tokenu/contracts/continuityScope";
import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";
import type { JsonValue } from "@/tokenu/contracts/json";
import type {
  ResolvedCachePolicy,
  ResolvedContinuityPolicy,
  ResolvedReasoningPolicy,
  ResolvedResponsesStatePolicy,
} from "@/tokenu/contracts/policy";
import type { TokenUProtocol } from "@/tokenu/contracts/protocol";

export interface ExecutionTimeoutPolicy {
  /**
   * Maximum duration for one upstream attempt.
   */
  readonly attemptTimeoutMs: number;

  /**
   * Optional tighter deadline for receiving the first upstream response bytes.
   */
  readonly upstreamStartTimeoutMs: number | null;
}

/**
 * Input contract for exactly one resolved upstream target.
 *
 * Routing, fallback and retry decisions happen outside this boundary.
 * The SingleTargetAdapter performs exactly one upstream attempt and must
 * not retry or discover alternative targets.
 */
export interface CoreExecutionRequestBase {
  /**
   * Client-request identity shared by all attempts for the request.
   */
  readonly requestId: string;

  /**
   * Unique identity for this exact upstream attempt.
   * Assigned by the TokenU Plan Runner before adapter invocation.
   */
  readonly attemptId: string;
  readonly target: ExecutionTarget;

  /**
   * Optional tenant-scoped identity for approved protocol state that must
   * survive beyond one translation stage or upstream attempt.
   *
   * It is resolved by TokenU orchestration before adapter invocation. The
   * adapter must not recover tenant identity from global state or infer it.
   */
  readonly continuityScope: TranslationContinuityScope | null;

  /**
   * Normalized protocol payload owned by TokenU.
   *
   * It must not contain raw provider credentials, internal authorization
   * headers, providerSpecificData or arbitrary upstream endpoint overrides.
   */
  readonly payload: JsonValue;

  /**
   * Protocol of the normalized request payload entering the translation
   * pipeline. It must be explicit and must never be inferred from model or
   * provider identity.
   */
  readonly requestProtocol: TokenUProtocol;

  /**
   * Protocol expected by the TokenU client for the translated response.
   */
  readonly clientResponseProtocol: TokenUProtocol;

  readonly timeoutPolicy: ExecutionTimeoutPolicy;
  readonly responsesStatePolicy: ResolvedResponsesStatePolicy;
  readonly reasoningPolicy: ResolvedReasoningPolicy;
  readonly cachePolicy: ResolvedCachePolicy;
  readonly continuityPolicy: ResolvedContinuityPolicy;
}

export interface StreamingCoreExecutionRequest extends CoreExecutionRequestBase {
  readonly stream: true;
}

export interface NonStreamingCoreExecutionRequest extends CoreExecutionRequestBase {
  readonly stream: false;
}

export type CoreExecutionRequest = StreamingCoreExecutionRequest | NonStreamingCoreExecutionRequest;
