import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";
import type { CoreExecutionResult } from "@/tokenu/contracts/coreExecutionResult";
import type { CoreExecutionErrorCategory } from "@/tokenu/contracts/executionError";

const EMPTY_USAGE = {
  inputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  totalTokens: null,
} as const;

export function createExecutionFailure(input: {
  requestId: string;
  attemptId: string;
  target: ExecutionTarget;
  category: CoreExecutionErrorCategory;
  message: string;
}): CoreExecutionResult {
  const now = new Date().toISOString();

  return {
    requestId: input.requestId,
    attemptId: input.attemptId,
    target: input.target,
    output: null,
    usage: EMPTY_USAGE,
    timing: {
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      timeToFirstByteMs: null,
    },
    status: "failed",
    error: {
      category: input.category,
      code: null,
      message: input.message,
      upstreamStatus: null,
    },
    retryability: "unknown",
    interruption: "none",
  };
}
