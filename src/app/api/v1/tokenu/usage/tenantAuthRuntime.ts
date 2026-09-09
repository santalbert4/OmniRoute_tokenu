import { getApiKeyMetadata, validateApiKey } from "@/lib/db/apiKeys";
import { getTokenURuntimeComposition } from "@/tokenu/runtime/tokenuRuntimeComposition";

import { resolveTokenUTenantAuth, type TokenUTenantAuthResult } from "./tenantAuth";

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
