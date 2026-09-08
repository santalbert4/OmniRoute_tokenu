import type { CoreExecutionRequest } from "@/tokenu/contracts/coreExecutionRequest";
import type { CoreExecutionResult } from "@/tokenu/contracts/coreExecutionResult";
import type { TokenUAdapterRegistry } from "@/tokenu/runtime/adapterRegistry";
import { createExecutionFailure } from "@/tokenu/runtime/executionResultFactory";

export class SingleAttemptExecutor {
  constructor(private readonly adapters: TokenUAdapterRegistry) {}

  async execute(request: CoreExecutionRequest): Promise<CoreExecutionResult> {
    const adapter = this.adapters.resolve(request.target.adapterId);

    if (!adapter) {
      return createExecutionFailure({
        requestId: request.requestId,
        attemptId: request.attemptId,
        target: request.target,
        category: "unsupported",
        message: `No TokenU adapter registered for ${request.target.adapterId}`,
      });
    }

    return adapter.execute(request);
  }
}
