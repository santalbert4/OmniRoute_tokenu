import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";

export interface ExecutionAttemptContext {
  readonly requestId: string;
  readonly attemptId: string;
  readonly sequence: number;
  readonly target: ExecutionTarget;
  readonly startedAt: string;
  readonly retryNumber: number;
}
