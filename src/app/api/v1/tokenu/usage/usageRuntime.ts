import { getTokenURuntimeComposition } from "@/tokenu/runtime/tokenuRuntimeComposition";

import { handleTokenUUsageGet } from "./usageHandler";

export async function handleResolvedTokenUUsageGet(
  request: Request,
  workspaceId: string
): Promise<Response> {
  const runtime = getTokenURuntimeComposition();

  return handleTokenUUsageGet(request, workspaceId, runtime.workspaceUsageQueryService);
}
