import { getTokenUApiRuntimeComposition } from "./productionRuntime";
import { resolveTokenUTenantAuth, type TokenUTenantAuthResult } from "./tenantAuth";

/**
 * TokenU API/server authentication composition.
 *
 * Only TokenU-owned bearer credentials are resolved here. Legacy OmniRoute
 * API keys, environment operator keys and client-supplied workspace identity
 * are deliberately outside this boundary.
 */
export async function resolveTokenUTenantAuthFromRuntime(
  request: Request
): Promise<TokenUTenantAuthResult> {
  const runtime = await getTokenUApiRuntimeComposition();

  return resolveTokenUTenantAuth(request, {
    resolveApiKeyPrincipalId(apiKey) {
      return runtime.tokenUApiKeyService.resolvePrincipalId(apiKey);
    },

    workspacePrincipalRepository: runtime.workspacePrincipalRepository,
  });
}
