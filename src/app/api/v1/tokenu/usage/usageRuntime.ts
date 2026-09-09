import { getTokenUApiRuntimeComposition } from "../productionRuntime";
import { handleTokenUUsageGet } from "./usageHandler";

export async function handleResolvedTokenUUsageGet(
  request: Request,
  workspaceId: string
): Promise<Response> {
  const runtime = await getTokenUApiRuntimeComposition();

  return handleTokenUUsageGet(request, workspaceId, runtime.workspaceUsageQueryService);
}
