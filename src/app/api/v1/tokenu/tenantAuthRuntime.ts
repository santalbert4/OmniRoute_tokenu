import { getApiKeyMetadata, validateApiKey } from "@/lib/db/apiKeys";
import { getTokenURuntimeComposition } from "@/tokenu/runtime/tokenuRuntimeComposition";

import { resolveTokenUTenantAuth, type TokenUTenantAuthResult } from "./tenantAuth";

/**
 * Current production bridge from OmniRoute API-key storage into TokenU
 * principal/workspace identity.
 *
 * The legacy key store is intentionally contained at this API boundary.
 * TokenU execution runtime and adapters do not depend on it.
 */
export async function resolveTokenUTenantAuthFromRuntime(
  request: Request
): Promise<TokenUTenantAuthResult> {
  const runtime = getTokenURuntimeComposition();

  return resolveTokenUTenantAuth(request, {
    validateApiKey,

    async getApiKeyPrincipalId(apiKey) {
      const metadata = await getApiKeyMetadata(apiKey);

      return metadata?.id ?? null;
    },

    workspacePrincipalRepository: runtime.workspacePrincipalRepository,
  });
}
