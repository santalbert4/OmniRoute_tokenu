import type { WorkspacePrincipalRepository } from "@/tokenu/runtime/workspacePrincipalRepository";

export type TokenUTenantAuthFailureCode = "unauthorized" | "workspace_not_assigned";

export type TokenUTenantAuthResult =
  | {
      readonly ok: true;
      readonly principalId: string;
      readonly workspaceId: string;
    }
  | {
      readonly ok: false;
      readonly status: 401 | 403;
      readonly code: TokenUTenantAuthFailureCode;
      readonly message: string;
    };

export interface TokenUTenantAuthDependencies {
  readonly validateApiKey: (apiKey: string) => Promise<boolean>;

  readonly getApiKeyPrincipalId: (apiKey: string) => Promise<string | null>;

  readonly workspacePrincipalRepository: Pick<WorkspacePrincipalRepository, "get">;
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

  const valid = await dependencies.validateApiKey(apiKey);

  if (!valid) {
    return unauthorized();
  }

  const principalId = await dependencies.getApiKeyPrincipalId(apiKey);

  if (!principalId || principalId === "env-key") {
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
