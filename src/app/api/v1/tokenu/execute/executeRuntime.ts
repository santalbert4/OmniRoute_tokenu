import { generateRequestId } from "@/shared/utils/requestId";
import { getTokenURuntimeComposition } from "@/tokenu/runtime/tokenuRuntimeComposition";

import { handleTokenUExecute } from "./executeHandler";

function currentUtcPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Production TokenU execute composition.
 *
 * The default runtime public route registry is intentionally empty until
 * reviewed provider routes are injected/configured in P6H.
 */
export async function handleResolvedTokenUExecute(
  request: Request,
  workspaceId: string
): Promise<Response> {
  const runtime = getTokenURuntimeComposition();

  return handleTokenUExecute(request, workspaceId, {
    publicExecutionResolver: runtime.publicExecutionResolver,

    tenantExecutionOrchestrator: runtime.tenantExecutionOrchestrator,

    generateRequestId,

    currentPeriod: currentUtcPeriod,
  });
}
