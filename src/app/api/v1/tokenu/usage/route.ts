import { NextResponse } from "next/server";

import { resolveTokenUTenantAuthFromRuntime } from "./tenantAuthRuntime";
import type { TokenUTenantAuthResult } from "./tenantAuth";
import { handleResolvedTokenUUsageGet } from "./usageRuntime";

export interface TokenUUsageRouteDependencies {
  readonly resolveTenantAuth: (request: Request) => Promise<TokenUTenantAuthResult>;

  readonly handleResolvedUsage: (request: Request, workspaceId: string) => Promise<Response>;
}

function authFailureResponse(
  result: Extract<TokenUTenantAuthResult, { readonly ok: false }>
): Response {
  return NextResponse.json(
    {
      error: {
        code: result.code,
        message: result.message,
      },
    },
    {
      status: result.status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function handleTokenUUsageRoute(
  request: Request,
  dependencies: TokenUUsageRouteDependencies
): Promise<Response> {
  const auth = await dependencies.resolveTenantAuth(request);

  if (!auth.ok) {
    return authFailureResponse(auth);
  }

  return dependencies.handleResolvedUsage(request, auth.workspaceId);
}

export async function GET(request: Request): Promise<Response> {
  return handleTokenUUsageRoute(request, {
    resolveTenantAuth: resolveTokenUTenantAuthFromRuntime,

    handleResolvedUsage: handleResolvedTokenUUsageGet,
  });
}
