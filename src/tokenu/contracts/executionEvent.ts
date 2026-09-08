import type { CoreExecutionResult } from "@/tokenu/contracts/coreExecutionResult";
import type { ExecutionAttemptContext } from "@/tokenu/contracts/executionAttemptContext";
import type { ExecutionDispatchError } from "@/tokenu/runtime/executionDispatchError";

export type ExecutionEvent =
  | {
      readonly type: "attempt-started";
      readonly context: ExecutionAttemptContext;
    }
  | {
      readonly type: "attempt-completed";
      readonly context: ExecutionAttemptContext;
      readonly result: CoreExecutionResult;
    }
  | {
      readonly type: "attempt-dispatch-failed";
      readonly context: ExecutionAttemptContext;
      readonly error: ExecutionDispatchError;
    };
