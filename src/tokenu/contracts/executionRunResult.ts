import type { CoreExecutionResult } from "@/tokenu/contracts/coreExecutionResult";
import type { ExecutionDispatchError } from "@/tokenu/runtime/executionDispatchError";

/**
 * Terminal result of one TokenU execution run.
 *
 * A run may fail either:
 * - after an upstream attempt was executed (CoreExecutionResult)
 * - before dispatch could create an upstream attempt
 */
export type ExecutionRunResult =
  | {
      readonly status: "completed";
      readonly result: CoreExecutionResult;
    }
  | {
      readonly status: "dispatch-failed";
      readonly error: ExecutionDispatchError;
    };
