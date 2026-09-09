import type {
  CoreExecutionRequest,
  NonStreamingCoreExecutionRequest,
  StreamingCoreExecutionRequest,
} from "@/tokenu/contracts/coreExecutionRequest";
import type { CoreExecutionResult } from "@/tokenu/contracts/coreExecutionResult";
import type { CoreExecutionErrorCategory, Retryability } from "@/tokenu/contracts/executionError";
import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";
import type { JsonValue } from "@/tokenu/contracts/json";
import type {
  NonStreamingSingleTargetExecutionControl,
  SingleTargetAdapter,
  StreamingSingleTargetExecutionControl,
} from "@/tokenu/contracts/singleTargetAdapter";
import type { NormalizedUsage } from "@/tokenu/contracts/usage";
import type { SingleTargetAdapterBinding } from "@/tokenu/runtime/adapterRegistry";
import { normalizeGroqHttpError } from "@/tokenu/adapters/groq/groqError";
import { prepareGroqRequest } from "@/tokenu/adapters/groq/groqRequest";

type ExecutionControl =
  StreamingSingleTargetExecutionControl | NonStreamingSingleTargetExecutionControl | undefined;

const EMPTY_USAGE: NormalizedUsage = {
  inputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  totalTokens: null,
};

type JsonObject = {
  readonly [key: string]: JsonValue;
};

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return (
    value !== undefined && value !== null && typeof value === "object" && !Array.isArray(value)
  );
}

function asJsonObject(value: JsonValue | undefined): JsonObject | null {
  return isJsonObject(value) ? value : null;
}

function numberOrNull(value: JsonValue | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Groq documents that the minimum cacheable prompt length across supported
 * prompt-caching models starts at 128 tokens. Below that provider-wide floor,
 * a cache hit is impossible even when prompt_tokens_details is omitted.
 *
 * At or above the floor we remain conservative: absent cache detail stays
 * unknown so differentiated cache pricing continues to fail closed.
 */
const GROQ_MIN_CACHEABLE_PROMPT_TOKENS = 128;

function normalizeCacheReadTokens(
  inputTokens: number | null,
  promptDetails: JsonObject | null
): number | null {
  if (promptDetails !== null) {
    return numberOrNull(promptDetails.cached_tokens);
  }

  if (inputTokens !== null && inputTokens < GROQ_MIN_CACHEABLE_PROMPT_TOKENS) {
    return 0;
  }

  return null;
}

function normalizeUsage(output: JsonValue): NormalizedUsage {
  const root = asJsonObject(output);
  const usage = asJsonObject(root?.usage);

  if (!usage) {
    return EMPTY_USAGE;
  }

  const inputTokens = numberOrNull(usage.prompt_tokens);
  const promptDetails = asJsonObject(usage.prompt_tokens_details);
  const completionDetails = asJsonObject(usage.completion_tokens_details);

  return {
    inputTokens,
    outputTokens: numberOrNull(usage.completion_tokens),
    reasoningTokens: numberOrNull(completionDetails?.reasoning_tokens),
    cacheReadTokens: normalizeCacheReadTokens(inputTokens, promptDetails),
    cacheWriteTokens: null,
    totalTokens: numberOrNull(usage.total_tokens),
  };
}

function sameTarget(left: ExecutionTarget, right: ExecutionTarget): boolean {
  return (
    left.providerId === right.providerId &&
    left.modelOfferingId === right.modelOfferingId &&
    left.upstreamModelId === right.upstreamModelId &&
    left.connectionId === right.connectionId &&
    left.credentialMode === right.credentialMode &&
    left.technicalProfileId === right.technicalProfileId &&
    left.adapterId === right.adapterId &&
    left.endpointProfileId === right.endpointProfileId &&
    left.serviceRegion === right.serviceRegion
  );
}

export class GroqSingleTargetAdapter implements SingleTargetAdapter {
  readonly id: string;

  constructor(
    private readonly binding: SingleTargetAdapterBinding,
    private readonly fetchImpl: typeof fetch
  ) {
    this.id = binding.target.adapterId;
  }

  execute(
    request: StreamingCoreExecutionRequest,
    control: StreamingSingleTargetExecutionControl
  ): Promise<CoreExecutionResult>;

  execute(
    request: NonStreamingCoreExecutionRequest,
    control?: NonStreamingSingleTargetExecutionControl
  ): Promise<CoreExecutionResult>;

  async execute(
    request: CoreExecutionRequest,
    control?: ExecutionControl
  ): Promise<CoreExecutionResult> {
    const startedMs = Date.now();
    const startedAt = new Date(startedMs).toISOString();

    if (!sameTarget(request.target, this.binding.target)) {
      return this.failure({
        request,
        startedAt,
        startedMs,
        category: "invalid-request",
        code: "binding-target-mismatch",
        message: "The execution request does not match the adapter binding.",
        retryability: "not-retryable",
      });
    }

    if (request.stream) {
      return this.failure({
        request,
        startedAt,
        startedMs,
        category: "unsupported",
        code: "groq-streaming-not-implemented",
        message: "Groq streaming is not implemented in TokenU Phase 2.9A.",
        retryability: "not-retryable",
      });
    }

    if (
      request.requestProtocol !== "openai" ||
      request.clientResponseProtocol !== "openai" ||
      this.binding.technicalModelProfile.upstreamProtocol !== "openai"
    ) {
      return this.failure({
        request,
        startedAt,
        startedMs,
        category: "unsupported",
        code: "protocol-direction-not-supported",
        message: "TokenU Phase 2.9A supports OpenAI Chat to OpenAI Chat execution only.",
        retryability: "not-retryable",
      });
    }

    const prepared = prepareGroqRequest({
      payload: request.payload,
      target: request.target,
      technicalModelProfile: this.binding.technicalModelProfile,
    });

    if (!prepared.ok) {
      return this.failure({
        request,
        startedAt,
        startedMs,
        category: "invalid-request",
        code: prepared.code,
        message: prepared.message,
        retryability: "not-retryable",
      });
    }

    const externalSignal = control?.signal;

    if (externalSignal?.aborted) {
      return this.failure({
        request,
        startedAt,
        startedMs,
        category: "cancelled",
        code: "client-cancelled",
        message: "The execution was cancelled before dispatch.",
        retryability: "not-retryable",
        status: "cancelled",
        interruption: "before-output",
      });
    }

    const controller = new AbortController();
    let timeoutKind: "attempt" | "upstream-start" | null = null;

    const abortForTimeout = (kind: "attempt" | "upstream-start") => {
      if (controller.signal.aborted) {
        return;
      }

      timeoutKind = kind;
      controller.abort();
    };

    const attemptTimeout =
      request.timeoutPolicy.attemptTimeoutMs > 0
        ? setTimeout(() => abortForTimeout("attempt"), request.timeoutPolicy.attemptTimeoutMs)
        : null;

    const upstreamStartTimeout =
      request.timeoutPolicy.upstreamStartTimeoutMs !== null &&
      request.timeoutPolicy.upstreamStartTimeoutMs > 0
        ? setTimeout(
            () => abortForTimeout("upstream-start"),
            request.timeoutPolicy.upstreamStartTimeoutMs
          )
        : null;

    const onExternalAbort = () => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    };

    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

    let timeToFirstByteMs: number | null = null;

    try {
      const response = await this.fetchImpl(this.binding.endpoint.url, {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.binding.credential.value}`,
        },
        body: JSON.stringify(prepared.payload),
        signal: controller.signal,
      });

      timeToFirstByteMs = Math.max(0, Date.now() - startedMs);

      if (upstreamStartTimeout) {
        clearTimeout(upstreamStartTimeout);
      }

      const bodyText = await response.text();

      if (!response.ok) {
        const normalized = normalizeGroqHttpError(response.status, bodyText);

        return this.failure({
          request,
          startedAt,
          startedMs,
          timeToFirstByteMs,
          category: normalized.category,
          code: normalized.code,
          message: normalized.message,
          retryability: normalized.retryability,
          upstreamStatus: response.status,
        });
      }

      let output: JsonValue;

      try {
        output = JSON.parse(bodyText) as JsonValue;
      } catch {
        return this.failure({
          request,
          startedAt,
          startedMs,
          timeToFirstByteMs,
          category: "translation",
          code: "invalid-json-response",
          message: "Groq returned a non-JSON success response.",
          retryability: "unknown",
          upstreamStatus: response.status,
        });
      }

      const completedMs = Date.now();

      return {
        requestId: request.requestId,
        attemptId: request.attemptId,
        target: request.target,
        output,
        usage: normalizeUsage(output),
        timing: {
          startedAt,
          completedAt: new Date(completedMs).toISOString(),
          durationMs: Math.max(0, completedMs - startedMs),
          timeToFirstByteMs,
        },
        status: "succeeded",
        error: null,
        retryability: "not-retryable",
        interruption: "none",
      };
    } catch {
      if (externalSignal?.aborted) {
        return this.failure({
          request,
          startedAt,
          startedMs,
          timeToFirstByteMs,
          category: "cancelled",
          code: "client-cancelled",
          message: "The execution was cancelled.",
          retryability: "not-retryable",
          status: "cancelled",
          interruption: "before-output",
        });
      }

      if (timeoutKind !== null) {
        return this.failure({
          request,
          startedAt,
          startedMs,
          timeToFirstByteMs,
          category: "timeout",
          code: timeoutKind === "upstream-start" ? "upstream-start-timeout" : "attempt-timeout",
          message:
            timeoutKind === "upstream-start"
              ? "Groq did not start responding before the upstream-start deadline."
              : "The Groq attempt exceeded its execution deadline.",
          retryability: "retryable",
          status: "timed-out",
          interruption: "before-output",
        });
      }

      return this.failure({
        request,
        startedAt,
        startedMs,
        timeToFirstByteMs,
        category: "network",
        code: "groq-network-error",
        message: "Groq could not be reached for this upstream attempt.",
        retryability: "retryable",
      });
    } finally {
      if (attemptTimeout) {
        clearTimeout(attemptTimeout);
      }

      if (upstreamStartTimeout) {
        clearTimeout(upstreamStartTimeout);
      }

      externalSignal?.removeEventListener("abort", onExternalAbort);
    }
  }

  private failure(input: {
    readonly request: CoreExecutionRequest;
    readonly startedAt: string;
    readonly startedMs: number;
    readonly timeToFirstByteMs?: number | null;
    readonly category: CoreExecutionErrorCategory;
    readonly code: string | null;
    readonly message: string;
    readonly retryability: Retryability;
    readonly upstreamStatus?: number | null;
    readonly status?: "failed" | "timed-out" | "cancelled";
    readonly interruption?: "none" | "before-output" | "after-partial-output";
  }): CoreExecutionResult {
    const completedMs = Date.now();

    return {
      requestId: input.request.requestId,
      attemptId: input.request.attemptId,
      target: input.request.target,
      output: null,
      usage: EMPTY_USAGE,
      timing: {
        startedAt: input.startedAt,
        completedAt: new Date(completedMs).toISOString(),
        durationMs: Math.max(0, completedMs - input.startedMs),
        timeToFirstByteMs: input.timeToFirstByteMs ?? null,
      },
      status: input.status ?? "failed",
      error: {
        category: input.category,
        code: input.code,
        message: input.message,
        upstreamStatus: input.upstreamStatus ?? null,
      },
      retryability: input.retryability,
      interruption: input.interruption ?? "none",
    };
  }
}
