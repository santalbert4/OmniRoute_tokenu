import type { CoreExecutionRequest } from "@/tokenu/contracts/coreExecutionRequest";
import type { JsonValue } from "@/tokenu/contracts/json";
import type { ExecutionAttemptContext } from "@/tokenu/contracts/executionAttemptContext";
import type { ExecutionPlanRequestFactory } from "@/tokenu/runtime/executionPlanRunner";

export interface OpenAIChatExecutionRequestFactoryOptions {
  readonly payload: JsonValue;

  /**
   * Conservative per-attempt execution deadline.
   */
  readonly attemptTimeoutMs?: number;
}

/**
 * Builds one non-streaming OpenAI Chat CoreExecutionRequest from a
 * runner-owned attempt context.
 *
 * The factory preserves requestId, attemptId and ExecutionTarget exactly.
 * It performs no routing, provider inference, credential lookup or fallback.
 */
export class OpenAIChatExecutionRequestFactory implements ExecutionPlanRequestFactory {
  private readonly attemptTimeoutMs: number;

  constructor(private readonly options: OpenAIChatExecutionRequestFactoryOptions) {
    this.attemptTimeoutMs = options.attemptTimeoutMs ?? 30_000;

    if (!Number.isInteger(this.attemptTimeoutMs) || this.attemptTimeoutMs <= 0) {
      throw new Error("TokenU OpenAI Chat execution requires a positive integer attempt timeout");
    }
  }

  create(context: ExecutionAttemptContext): CoreExecutionRequest {
    return {
      requestId: context.requestId,
      attemptId: context.attemptId,
      target: context.target,
      continuityScope: null,
      payload: this.options.payload,
      requestProtocol: "openai" as const,
      clientResponseProtocol: "openai" as const,
      timeoutPolicy: {
        attemptTimeoutMs: this.attemptTimeoutMs,
        upstreamStartTimeoutMs: null,
      },
      responsesStatePolicy: {
        upstreamStore: false as const,
        preservePreviousResponseId: false as const,
      },
      reasoningPolicy: {
        enabled: false as const,
        transport: "none" as const,
        effort: null,
        budgetTokens: null,
        preserveReasoningContent: false,
        parseTextualReasoningTags: false,
      },
      cachePolicy: {
        mechanism: "none" as const,
        markerAction: "strip" as const,
        synthesizedMarkerTtl: null,
      },
      continuityPolicy: {
        constraints: [],
        crossProviderFallbackAllowed: false as const,
      },
      stream: false as const,
    };
  }
}
