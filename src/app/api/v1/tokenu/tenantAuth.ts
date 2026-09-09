import type { WorkspacePrincipalRepository } from "@/tokenu/runtime/workspacePrincipalRepository";

export type TokenUTenantAuthResult =
  | {
      readonly ok: true;

      readonly principalId: string;

      readonly workspaceId: string;
    }
  | {
      readonly ok: false;

      readonly status: 401 | 403;

      readonly code: "unauthorized" | "workspace_not_assigned";

      readonly message: string;
    };

export interface TokenUTenantAuthDependencies {
  /**
   * Resolve raw TokenU bearer material to its persistent TokenU API-key id.
   *
   * Credential validation, revocation and expiration belong behind this
   * dependency. The raw bearer token must never become a principal id.
   */
  readonly resolveApiKeyPrincipalId: (apiKey: string) => Promise<string | null>;

  /**
   * Authoritative tenant binding.
   *
   * Public requests never provide or override workspace identity.
   */
  readonly workspacePrincipalRepository: WorkspacePrincipalRepository;
}

function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization") ?? "";

  const match = authorization.match(/^Bearer\s+(.+)$/i);

  const token = match?.[1]?.trim();

  return token || null;
}

function unauthorized(): TokenUTenantAuthResult {
  return {
    ok: false,
    status: 401,
    code: "unauthorized",
    message: "Unauthorized",
  };
}

export async function resolveTokenUTenantAuth(
  request: Request,
  dependencies: TokenUTenantAuthDependencies
): Promise<TokenUTenantAuthResult> {
  const apiKey = extractBearerToken(request);

  if (!apiKey) {
    return unauthorized();
  }

  const principalId = await dependencies.resolveApiKeyPrincipalId(apiKey);

  if (!principalId?.trim()) {
    return unauthorized();
  }

  const binding = await dependencies.workspacePrincipalRepository.get("api_key", principalId);

  if (!binding) {
    return {
      ok: false,
      status: 403,
      code: "workspace_not_assigned",
      message: "API key is not assigned to a TokenU workspace",
    };
  }

  return {
    ok: true,
    principalId,
    workspaceId: binding.workspaceId,
  };
}
