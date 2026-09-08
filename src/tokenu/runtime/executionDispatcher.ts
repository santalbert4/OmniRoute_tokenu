import type { CoreExecutionRequest } from "@/tokenu/contracts/coreExecutionRequest";
import type { CoreExecutionResult } from "@/tokenu/contracts/coreExecutionResult";
import type { ExecutionDispatchError } from "@/tokenu/runtime/executionDispatchError";

export type ExecutionDispatchResult =
  | {
      readonly ok: true;
      readonly result: CoreExecutionResult;
    }
  | {
      readonly ok: false;
      readonly error: ExecutionDispatchError;
    };

export interface TokenUExecutionDispatcher {
  execute(request: CoreExecutionRequest): Promise<ExecutionDispatchResult>;
}
